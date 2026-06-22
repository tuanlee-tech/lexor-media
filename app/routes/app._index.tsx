import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Button, TextField, Box } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { authenticate } from "../shopify.server";
import { getApiClient } from "../lib/api.server";
import type { Category, SubCategory, Folder, MediaItem } from "../types/media";

import type { StructureNode, EditDrawerData, AddingState, MediaItemLocal } from "../components/structure/types";
import { TreeNodePolaris } from "../components/structure/TreeNodePolaris";
import { SortableTreeNode } from "../components/structure/SortableTreeNode";
import { EditPanelPolaris } from "../components/structure/EditPanelPolaris";
import { AddMediaModalPolaris, type AddMediaResult } from "../components/structure/AddMediaModalPolaris";
import { MediaGridPolaris } from "../components/structure/MediaGridPolaris";
import { ContentGridPolaris, type ContentGridItem } from "../components/structure/ContentGridPolaris";
import { FolderModalPolaris } from "../components/structure/FolderModalPolaris";

// ── Loader ────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  try {
    const api = await getApiClient(request);
    const [catsRes, subsRes, foldersRes, mediaRes] = await Promise.all([
      api.getCategories({ limit: "1000" }),
      api.getSubCategories({ limit: "1000" }),
      api.getFolders({ limit: "5000" }),
      api.getMediaItems({ limit: "1000" })
    ]);

    return {
      categories: catsRes.items || [],
      subCategories: subsRes.items || [],
      folders: foldersRes.items || [],
      media: mediaRes.items || [],
      error: null,
    };
  } catch (error) {
    return {
      categories: [], subCategories: [], folders: [], media: [],
      error: error instanceof Error ? error.message : "Failed to load data",
    };
  }
};

const parseBool = (v: any) => v === true || v === 1 || v === "1" || v === "true";

// ── Build Tree ────────────────────────────────────────────────

function buildTree(cats: Category[], subs: SubCategory[], flds: Folder[], allMedia: MediaItem[]): StructureNode[] {
  const subsByCat = new Map<string, SubCategory[]>();
  subs.forEach(s => { const arr = subsByCat.get(s.category_id) || []; arr.push(s); subsByCat.set(s.category_id, arr); });

  const fldsBySub = new Map<string, Folder[]>();
  flds.forEach(f => { const arr = fldsBySub.get(f.sub_category_id) || []; arr.push(f); fldsBySub.set(f.sub_category_id, arr); });

  return cats.sort((a, b) => a.sort_order - b.sort_order).map(cat => ({
    id: cat.id, type: "category", title: cat.title, handle: cat.handle, parent_id: null,
    sort_order: cat.sort_order, is_active: parseBool(cat.is_active), icon_svg: cat.icon_svg,
    children: (subsByCat.get(cat.id) || []).sort((a, b) => a.sort_order - b.sort_order).map(sub => ({
      id: sub.id, type: "sub_category", title: sub.title, handle: sub.handle, parent_id: cat.id, grandparent_id: null,
      sort_order: sub.sort_order, is_active: parseBool(sub.is_active),
      children: (fldsBySub.get(sub.id) || []).sort((a, b) => a.sort_order - b.sort_order).map(fld => ({
        id: fld.id, type: "folder", title: fld.title, handle: fld.handle, parent_id: sub.id, grandparent_id: cat.id,
        sort_order: fld.sort_order, is_active: parseBool(fld.is_active), cover_image_url: fld.cover_image_url, description: fld.description,
        children: [], media_count: allMedia.filter(m => m.folder_id === fld.id).length
      })),
      media_count: allMedia.filter(m => m.sub_category_id === sub.id && !m.folder_id).length
    })),
    media_count: allMedia.filter(m => m.category_id === cat.id && !m.sub_category_id && !m.folder_id).length
  }));
}

// ── Build Unified Content Grid Items ──────────────────────────

function buildContentGridItems(
  folders: StructureNode[],
  media: MediaItemLocal[]
): ContentGridItem[] {
  const folderItems: ContentGridItem[] = folders.map(f => ({
    id: `folder_${f.id}`,
    type: "folder",
    title: f.title,
    sort_order: f.sort_order,
    is_active: f.is_active,
    media_count: f.media_count,
    cover_image_url: f.cover_image_url,
    description: f.description,
    originalFolder: f,
  }));

  const mediaItems: ContentGridItem[] = media.map(m => ({
    id: `media_${m.id}`,
    type: "media",
    title: m.title,
    sort_order: m.sort_order,
    is_active: m.is_active ?? true,
    thumbnail_url: m.thumbnail_url,
    media_type: m.media_type,
    alt: m.alt,
    originalMedia: m,
  }));

  // Merge and sort by sort_order. Folder comes first if tie.
  return [...folderItems, ...mediaItems].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.type === "folder" ? -1 : 1;
  });
}

// ── Action ────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  try {
    const api = await getApiClient(request);

    switch (intent) {
      case "create": {
        const type = formData.get("type") as string;
        const title = formData.get("title") as string;
        const parentId = formData.get("parent_id") as string | null;
        const grandparentId = formData.get("grandparent_id") as string | null;

        if (type === "category") await api.createCategory({ title, is_active: true });
        else if (type === "sub_category" && parentId) await api.createSubCategory({ title, category_id: parentId, is_active: true });
        else if (type === "folder" && parentId && grandparentId) await api.createFolder({ title, category_id: grandparentId, sub_category_id: parentId, is_active: true });
        return { success: true };
      }
      case "update": {
        const type = formData.get("type") as string;
        const id = formData.get("id") as string;
        const payloadJson = formData.get("payload") as string;
        const payload = JSON.parse(payloadJson);

        if (type === "category") await api.updateCategory(id, payload);
        else if (type === "sub_category") await api.updateSubCategory(id, payload);
        else if (type === "folder") await api.updateFolder(id, payload);
        else if (type === "media") await api.updateMediaItem(id, payload);
        return { success: true };
      }
      case "delete": {
        const type = formData.get("type") as string;
        const id = formData.get("id") as string;
        if (type === "category") await api.deleteCategory(id);
        else if (type === "sub_category") await api.deleteSubCategory(id);
        else if (type === "folder") await api.deleteFolder(id);
        return { success: true };
      }
      case "delete_media": {
        const id = formData.get("id") as string;
        await api.deleteMediaItem(id);
        return { success: true };
      }
      case "add_media_bulk": {
        const filesJson = formData.get("files") as string;
        const categoryId = formData.get("category_id") as string | null;
        const subCategoryId = formData.get("sub_category_id") as string | null;
        const folderId = formData.get("folder_id") as string | null;
        const startSortOrder = parseInt(formData.get("start_sort_order") as string || "0");
        const files = JSON.parse(filesJson) as AddMediaResult[];

        await Promise.allSettled(files.map((file, index) => {
          return api.createMediaItem({
            category_id: categoryId!,
            sub_category_id: subCategoryId || null,
            folder_id: folderId || null,
            media_type: file.media_type,
            source_type: file.type === "shopify" ? "shopify" : file.type === "youtube" ? "youtube" : "external",
            url: file.url,
            thumbnail_url: file.thumbnail_url || null,
            title: file.title || "Media",
            alt: file.alt || "",
            width: 0, height: 0, duration: 0,
            is_active: true,
            sort_order: startSortOrder + (index * 10)
          });
        }));
        return { success: true };
      }
      case "reorder": {
        const resource = formData.get("resource") as string;
        const itemsJson = formData.get("items") as string;

        if (resource === "mixed") {
          // Mixed reorder: both folders and media in one call
          const mixed = JSON.parse(itemsJson) as {
            folders?: Array<{ id: string; sort_order: number }>;
            media?: Array<{ id: string; sort_order: number }>;
          };
          if (mixed.folders && mixed.folders.length > 0) {
            await api.bulkUpdateSortOrder("folders", mixed.folders);
          }
          if (mixed.media && mixed.media.length > 0) {
            await api.bulkUpdateSortOrder("media", mixed.media);
          }
        } else {
          const items = JSON.parse(itemsJson) as Array<{ id: string; sort_order: number }>;
          await api.bulkUpdateSortOrder(resource as "categories" | "sub-categories" | "folders" | "media", items);
        }
        return { success: true };
      }
      default: return { success: false, error: "Unknown intent" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Action failed" };
  }
};

// ── Page Component ────────────────────────────────────────────

// ── Page Component ────────────────────────────────────────────

export default function StructurePage() {
  const { categories, subCategories, folders, media, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const tree = useMemo(() => buildTree(categories, subCategories, folders, media), [categories, subCategories, folders, media]);

  // Local tree state for optimistic reordering
  const [localTree, setLocalTree] = useState<StructureNode[]>(tree);
  const [localMedia, setLocalMedia] = useState<any[]>(media);

  // Sync from loader only when no optimistic reorder is in flight
  useEffect(() => {
    if (!hasOptimisticReorderRef.current) {
      setLocalTree(tree);
    }
  }, [tree]);
  useEffect(() => {
    if (!hasOptimisticReorderRef.current) {
      setLocalMedia(media);
    }
  }, [media]);

  // When fetcher goes idle after a reorder, clear the guard and sync from server
  useEffect(() => {
    if (fetcher.state === "idle" && hasOptimisticReorderRef.current) {
      hasOptimisticReorderRef.current = false;
      setLocalTree(tree);
      setLocalMedia(media);
    }
  }, [fetcher.state, tree, media]);

  const [search, setSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Folder modal state
  const [openFolder, setOpenFolder] = useState<StructureNode | null>(null);
  const openFolderRef = useRef<StructureNode | null>(null);

  // Cleanup ref khi component unmount
  useEffect(() => {
    return () => {
      openFolderRef.current = null;
    };
  }, []);

  const [editingData, setEditingDataState] = useState<EditDrawerData | null>(null);
  const editingDataRef = useRef<EditDrawerData | null>(null);
  const isDirtyRef = useRef(false);
  // Guard: prevent loader sync from overriding optimistic reorder updates
  const hasOptimisticReorderRef = useRef(false);

  const setEditingData = useCallback((data: EditDrawerData | null, isDirty = false) => {
    setEditingDataState(data);
    editingDataRef.current = data;
    if (data === null) {
      isDirtyRef.current = false;
    } else if (isDirty) {
      isDirtyRef.current = true;
    }
  }, []);

  const flushAutoSave = useCallback(() => {
    if (isDirtyRef.current && editingDataRef.current) {
      const data = editingDataRef.current;
      fetcher.submit(
        { intent: "update", id: data.id, type: data.type, payload: JSON.stringify(data) },
        { method: "POST" }
      );
      isDirtyRef.current = false;
    }
  }, [fetcher]);

  const closeEditPanel = useCallback(() => {
    flushAutoSave();
    setEditingData(null);
  }, [flushAutoSave, setEditingData]);

  const openEditPanel = useCallback((newData: EditDrawerData) => {
    flushAutoSave();
    setEditingData(newData, false);
  }, [flushAutoSave, setEditingData]);

  const [addingState, setAddingState] = useState<AddingState | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [addingMediaTo, setAddingMediaTo] = useState<StructureNode | null>(null);

  const isSubmitting = fetcher.state !== "idle";

  // dnd-kit sensors — activate after 8px movement to avoid conflicts with click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data) {
      if (fetcher.data.success) {
        shopify.toast.show("Saved successfully");
        setAddingState(null);
        setNewTitle("");
        setAddingMediaTo(null);
      } else if ("error" in fetcher.data) {
        shopify.toast.show(String(fetcher.data.error), { isError: true });
      }
    }
  }, [fetcher.data, shopify]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleEditSave = useCallback((data: EditDrawerData) => {
    fetcher.submit(
      { intent: "update", id: data.id, type: data.type, payload: JSON.stringify(data) },
      { method: "POST" }
    );
    setEditingData(null);
  }, [fetcher, setEditingData]);

  const handleDelete = useCallback((id: string, type: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      if (editingDataRef.current?.id === id) {
        setEditingData(null);
      } else {
        flushAutoSave();
      }
      fetcher.submit({ intent: "delete", type, id }, { method: "POST" });
    }
  }, [fetcher, flushAutoSave, setEditingData]);

  const handleDeleteMedia = useCallback((id: string) => {
    if (confirm("Remove this media?")) {
      if (editingDataRef.current?.id === id) {
        setEditingData(null);
      } else {
        flushAutoSave();
      }
      fetcher.submit({ intent: "delete_media", id }, { method: "POST" });
    }
  }, [fetcher, flushAutoSave, setEditingData]);

  const submitCreate = useCallback(() => {
    if (!addingState || !newTitle.trim()) return;
    fetcher.submit({
      intent: "create", type: addingState.childType, title: newTitle.trim(),
      parent_id: addingState.parentId, grandparent_id: addingState.grandparentId || ""
    }, { method: "POST" });
  }, [addingState, newTitle, fetcher]);

  const submitBulkMedia = (node: StructureNode, items: AddMediaResult[]) => {
    const data: any = { intent: "add_media_bulk", files: JSON.stringify(items) };
    if (node.type === "category") data.category_id = node.id;
    if (node.type === "sub_category") { data.sub_category_id = node.id; data.category_id = node.parent_id; }
    if (node.type === "folder") { data.folder_id = node.id; data.sub_category_id = node.parent_id; data.category_id = node.grandparent_id; }

    const nodeMedia = localMedia.filter(m =>
      (node.type === "category" && m.category_id === node.id && !m.sub_category_id && !m.folder_id) ||
      (node.type === "sub_category" && m.sub_category_id === node.id && !m.folder_id) ||
      (node.type === "folder" && m.folder_id === node.id)
    );
    const maxSortOrder = nodeMedia.length > 0 ? Math.max(...nodeMedia.map(m => m.sort_order || 0)) : -10;
    data.start_sort_order = String(maxSortOrder + 10);

    fetcher.submit(data, { method: "POST" });
  };

  // ── Unified Content Reorder ─────────────────────────────────

  /**
   * Find which sub_category a given prefixed content item belongs to.
   * Returns the sub_category node and the unified item list for that scope.
   */
  const findContentScope = useCallback((
    nodes: StructureNode[],
    targetPrefixedId: string
  ): {
    subCategory: StructureNode;
    folders: StructureNode[];
    medias: MediaItemLocal[];
  } | null => {
    for (const cat of nodes) {
      for (const sub of cat.children) {
        const subMedia = localMedia.filter(
          (m: any) => m.sub_category_id === sub.id && !m.folder_id
        ).map((m: any) => ({ ...m, is_active: parseBool(m.is_active) })) as MediaItemLocal[];

        const allItems = buildContentGridItems(sub.children, subMedia);
        if (allItems.some(item => item.id === targetPrefixedId)) {
          return { subCategory: sub, folders: sub.children, medias: subMedia };
        }
      }
      // Check nested (not applicable with current 3-level structure, but for completeness)
      for (const sub of cat.children) {
        for (const fld of sub.children) {
          const folderMedia = localMedia.filter(
            (m: any) => m.folder_id === fld.id
          ).map((m: any) => ({ ...m, is_active: parseBool(m.is_active) })) as MediaItemLocal[];
          const folderItems = buildContentGridItems([], folderMedia);
          if (folderItems.some(item => item.id === targetPrefixedId)) {
            return { subCategory: sub, folders: [fld], medias: folderMedia };
          }
        }
      }
    }
    return null;
  }, [localMedia]);

  /**
   * Handle reorder inside folder modal.
   */
  const handleReorderMediaInFolder = useCallback((folderId: string, items: Array<{ id: string; sort_order: number }>) => {
    // Optimistic update
    setLocalMedia((prev: any[]) => {
      const next = [...prev];
      items.forEach(update => {
        const idx = next.findIndex((m: any) => m.id === update.id);
        if (idx !== -1) next[idx] = { ...next[idx], sort_order: update.sort_order };
      });
      return next;
    });

    fetcher.submit(
      { intent: "reorder", resource: "media", items: JSON.stringify(items) },
      { method: "POST" }
    );
  }, [fetcher]);

  // ── Drag & Drop handler ─────────────────────────────────────

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // ═══════════════════════════════════════════════════════════
    // CASE 1: Unified Content Drag (folder_* or media_* prefixed IDs)
    // ═══════════════════════════════════════════════════════════
    if (activeId.startsWith("folder_") || activeId.startsWith("media_")) {
      const scope = findContentScope(localTree, activeId);
      if (!scope) return;

      const { subCategory, folders, medias } = scope;
      const allItems = buildContentGridItems(folders, medias);

      const oldIndex = allItems.findIndex(item => item.id === activeId);
      const newIndex = allItems.findIndex(item => item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(allItems, oldIndex, newIndex);

      // Extract folder and media updates with separate sort_order sequences
      const folderUpdates: Array<{ id: string; sort_order: number }> = [];
      const mediaUpdates: Array<{ id: string; sort_order: number }> = [];

      reordered.forEach((item, index) => {
        if (item.type === "folder" && item.originalFolder) {
          folderUpdates.push({ id: item.originalFolder.id, sort_order: index * 10 });
        } else if (item.type === "media" && item.originalMedia) {
          mediaUpdates.push({ id: item.originalMedia.id, sort_order: index * 10 });
        }
      });

      // Set guard to prevent loader sync from overriding optimistic updates
      hasOptimisticReorderRef.current = true;

      // Optimistic update: update localTree folder sort_orders
      if (folderUpdates.length > 0) {
        setLocalTree(prev => {
          const updateFolders = (nodes: StructureNode[]): StructureNode[] => {
            return nodes.map(n => {
              if (n.id === subCategory.id) {
                // Update sort_order for folders of this sub_category
                return {
                  ...n,
                  children: n.children.map(child => {
                    const update = folderUpdates.find(u => u.id === child.id);
                    return update ? { ...child, sort_order: update.sort_order } : child;
                  })
                };
              }
              return { ...n, children: updateFolders(n.children) };
            });
          };
          return updateFolders(prev);
        });
      }

      // Optimistic update: update localMedia sort_orders
      if (mediaUpdates.length > 0) {
        setLocalMedia((prev: any[]) => {
          const next = [...prev];
          mediaUpdates.forEach(update => {
            const idx = next.findIndex((m: any) => m.id === update.id);
            if (idx !== -1) next[idx] = { ...next[idx], sort_order: update.sort_order };
          });
          return next;
        });
      }

      // Persist both folder and media updates in a single fetcher call
      if (folderUpdates.length > 0 || mediaUpdates.length > 0) {
        fetcher.submit(
          {
            intent: "reorder",
            resource: "mixed",
            items: JSON.stringify({ folders: folderUpdates, media: mediaUpdates }),
          },
          { method: "POST" }
        );
      }

      return;
    }

    // ═══════════════════════════════════════════════════════════
    // CASE 2: Tree Node Drag (category / sub_category reorder)
    // ═══════════════════════════════════════════════════════════

    // Set guard to prevent loader sync from overriding optimistic updates
    hasOptimisticReorderRef.current = true;

    // Helper: find a node and its siblings array in the tree
    const findNodeContext = (nodes: StructureNode[], parentId: string | null): { siblings: StructureNode[]; node: StructureNode; parent: string | null } | null => {
      for (const n of nodes) {
        if (n.id === activeId) return { siblings: nodes, node: n, parent: parentId };
        const found = findNodeContext(n.children, n.id);
        if (found) return found;
      }
      return null;
    };

    const ctx = findNodeContext(localTree, null);
    if (!ctx) return;

    const oldIndex = ctx.siblings.findIndex(n => n.id === activeId);
    const newIndex = ctx.siblings.findIndex(n => n.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    // Same-level reorder
    const reordered = arrayMove(ctx.siblings, oldIndex, newIndex);

    // Determine resource type for the API
    const nodeType = ctx.node.type;
    const resource = nodeType === "category" ? "categories" : nodeType === "sub_category" ? "sub-categories" : "folders";

    // Assign new sort_order values
    const sortUpdates = reordered.map((n, i) => ({ id: n.id, sort_order: i * 10 }));

    // Optimistic: update local tree
    setLocalTree(prev => {
      const applyReorder = (nodes: StructureNode[]): StructureNode[] => {
        if (nodes.some(n => n.id === activeId)) {
          return arrayMove(nodes, nodes.findIndex(n => n.id === activeId), nodes.findIndex(n => n.id === overId))
            .map((n, i) => ({ ...n, sort_order: i * 10 }));
        }
        return nodes.map(n => ({ ...n, children: applyReorder(n.children) }));
      };
      return applyReorder(prev);
    });

    // Persist to backend
    fetcher.submit(
      { intent: "reorder", resource, items: JSON.stringify(sortUpdates) },
      { method: "POST" }
    );
  }, [localTree, localMedia, findContentScope, fetcher]);

  // ── Render Helpers ──────────────────────────────────────────

  /**
   * Get media for a specific node (category, sub_category, or folder).
   * Applies optimistic edits from the edit panel.
   */
  const getNodeMedia = useCallback((node: StructureNode): MediaItemLocal[] => {
    const filtered = localMedia.filter((m: any) =>
      (node.type === "category" && m.category_id === node.id && !m.sub_category_id && !m.folder_id) ||
      (node.type === "sub_category" && m.sub_category_id === node.id && !m.folder_id) ||
      (node.type === "folder" && m.folder_id === node.id)
    ).sort((a: any, b: any) => a.sort_order - b.sort_order).map((m: any) => ({ ...m, is_active: parseBool(m.is_active) })) as MediaItemLocal[];

    return filtered.map(m => {
      if (editingData?.type === "media" && editingData.id === m.id) {
        return {
          ...m,
          thumbnail_url: editingData.thumbnail_url !== undefined ? editingData.thumbnail_url : m.thumbnail_url,
          is_active: editingData.is_active !== undefined ? parseBool(editingData.is_active) : m.is_active,
          media_type: editingData.media_type !== undefined ? (editingData.media_type as "image" | "video") : m.media_type
        };
      }
      return m;
    });
  }, [localMedia, editingData]);

  const renderChildNode = (child: StructureNode, depth: number) => {
    const nodeMedia = getNodeMedia(child);

    // For sub_category: build unified content grid with folders + media
    const isSubCategory = child.type === "sub_category";
    const contentGridItems = isSubCategory
      ? buildContentGridItems(child.children, nodeMedia)
      : [];

    return (
      <div key={child.id}>
        <SortableTreeNode
          node={child}
          depth={depth}
          expandedNodes={expandedNodes}
          toggleExpand={toggleExpand}
          onEdit={(node) => openEditPanel({
            id: node.id,
            type: node.type,
            title: node.title,
            handle: node.handle,
            icon_svg: node.icon_svg || "",
            is_active: node.is_active,
            description: node.description,
            cover_image_url: node.cover_image_url
          })}
          onAddChild={(pid, ptype, ctype) => {
            closeEditPanel();
            setAddingState({ parentId: pid, parentType: ptype, childType: ctype, grandparentId: child.parent_id });
          }}
          onAddMedia={(node) => {
            closeEditPanel();
            setAddingMediaTo(node);
          }}
          onDelete={handleDelete}
          isSubmitting={isSubmitting}
          renderChildNode={(c, d) => renderSortableChildren(child, c, d)}
          renderMediaGrid={() => (
            <>
              {isSubCategory ? (
                /* Sub_category: unified content grid (folders + media) */
                contentGridItems.length > 0 ? (
                  <ContentGridPolaris
                    items={contentGridItems}
                    depth={depth}
                    onEditMedia={(m) => openEditPanel({
                      id: m.id,
                      type: "media",
                      title: m.title,
                      url: m.url,
                      thumbnail_url: m.thumbnail_url,
                      alt: m.alt,
                      is_active: m.is_active,
                      media_type: m.media_type,
                      source_type: m.source_type
                    })}
                    onEditFolder={(node) => openEditPanel({
                      id: node.id,
                      type: node.type,
                      title: node.title,
                      handle: node.handle,
                      cover_image_url: node.cover_image_url,
                      description: node.description,
                      is_active: node.is_active
                    })}
                    onOpenFolder={(node) => {
                      setOpenFolder(node);
                      openFolderRef.current = node; // Lưu vào ref
                    }}
                    onDeleteMedia={handleDeleteMedia}
                    onDeleteFolder={(id, title) => handleDelete(id, "folder", title)}
                    activeId={editingData?.id}
                  />
                ) : (
                  <div style={{ paddingLeft: `${12 + (depth + 1) * 24 + 48}px`, paddingBottom: "12px", paddingTop: "8px" }}>
                    <InlineStack gap="200">
                      <Button size="micro" icon={PlusIcon} onClick={() => { closeEditPanel(); setAddingMediaTo(child); }}>
                        Add Media
                      </Button>
                      <Button size="micro" onClick={() => {
                        closeEditPanel();
                        setAddingState({ parentId: child.id, parentType: "sub_category", childType: "folder", grandparentId: child.parent_id });
                        setNewTitle("");
                      }}>
                        + Folder
                      </Button>
                    </InlineStack>
                  </div>
                )
              ) : (
                /* Category: only media (no folders at this level) */
                nodeMedia.length > 0 ? (
                  <MediaGridPolaris
                    media={nodeMedia}
                    depth={depth}
                    onDelete={handleDeleteMedia}
                    onEdit={(m) => openEditPanel({
                      id: m.id,
                      type: "media",
                      title: m.title,
                      url: m.url,
                      thumbnail_url: m.thumbnail_url,
                      alt: m.alt,
                      is_active: m.is_active,
                      media_type: m.media_type,
                      source_type: m.source_type
                    })}
                    activeMediaId={editingData?.id}
                  />
                ) : child.type !== "category" && (
                  <div style={{ paddingLeft: `${12 + (depth + 1) * 24 + 48}px`, paddingBottom: "12px", paddingTop: "8px" }}>
                    <Button size="micro" icon={PlusIcon} onClick={() => { closeEditPanel(); setAddingMediaTo(child); }}>
                      Add Media to {child.title}
                    </Button>
                  </div>
                )
              )}
            </>
          )}
          addingState={addingState}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          submitCreate={submitCreate}
          cancelCreate={() => setAddingState(null)}
          isActiveEdit={editingData?.id === child.id}
        />
      </div>
    );
  };

  // Renders children of a node wrapped in SortableContext.
  // Folder children of sub_categories are rendered inside ContentGrid,
  // so we skip them here to avoid duplicate rendering.
  const renderSortableChildren = (parent: StructureNode, child: StructureNode, depth: number) => {
    if (child.type === "folder") return null; // Folders live in ContentGrid, not tree rows
    return renderChildNode(child, depth);
  };

  // Top-level category IDs for root SortableContext
  const rootIds = localTree.map(n => n.id);

  // Media inside the opened folder (for modal)
  const folderModalMedia = useMemo(() => {
    if (!openFolder) return [];
    return getNodeMedia(openFolder);
  }, [openFolder, getNodeMedia]);

  // ── JSX ─────────────────────────────────────────────────────

  return (
    <Page
      title="Structure"
      primaryAction={{
        content: "Add Category",
        icon: PlusIcon,
        onAction: () => { closeEditPanel(); setAddingState({ parentId: "root", parentType: "category", childType: "category" }); setNewTitle(""); },
      }}
    >
      <Layout>
        {/* Left Column: Tree */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400" borderBlockEndWidth="025" borderColor="border-secondary">
              <TextField
                label="Search tree"
                labelHidden
                value={search}
                onChange={setSearch}
                autoComplete="off"
                placeholder="Search categories, folders..."
                clearButton
                onClearButtonClick={() => setSearch("")}
              />
            </Box>

            {addingState?.parentId === "root" && (
              <Box padding="400" background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border-secondary">
                <InlineStack gap="200" align="start" blockAlign="center">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="New Category" labelHidden
                      value={newTitle} onChange={setNewTitle} autoFocus
                      autoComplete="off" placeholder="New Category title…"
                    />
                  </div>
                  <Button variant="primary" onClick={submitCreate} disabled={isSubmitting || !newTitle.trim()}>Add</Button>
                  <Button onClick={() => setAddingState(null)}>Cancel</Button>
                </InlineStack>
              </Box>
            )}

            <Box padding="0">
              {localTree.length === 0 && !error ? (
                <Box padding="800">
                  <BlockStack align="center" inlineAlign="center" gap="200">
                    <Text as="p" tone="subdued">No categories yet</Text>
                    <Button onClick={() => { closeEditPanel(); setAddingState({ parentId: "root", parentType: "category", childType: "category" }); setNewTitle(""); }}>Add the first category</Button>
                  </BlockStack>
                </Box>
              ) : (
                <DndContext
                  id="dnd-tree"
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
                    {localTree.map((node) => renderChildNode(node, 0))}
                  </SortableContext>
                </DndContext>
              )}
            </Box>
          </Card>
        </Layout.Section>

        {/* Right Column: Edit Panel */}
        {editingData && (
          <Layout.Section variant="oneThird">
            <EditPanelPolaris
              data={editingData}
              onClose={closeEditPanel}
              onSave={handleEditSave}
              onChange={(newData) => setEditingData(newData, true)}
              isSubmitting={isSubmitting}
            />
          </Layout.Section>
        )}
      </Layout>

      {/* Add Media Modal — mount SAU FolderModal để đè lên trên */}
      {addingMediaTo && (
        <AddMediaModalPolaris
          open={true}
          onClose={() => setAddingMediaTo(null)}
          onSubmit={(items) => {
            submitBulkMedia(addingMediaTo, items);
            setAddingMediaTo(null);
            // Restore folder modal nếu trước đó tạm tắt để add media
            if (openFolderRef.current) {
              setOpenFolder(openFolderRef.current);
              openFolderRef.current = null;
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Folder Detail Modal */}
      <FolderModalPolaris
        open={!!openFolder}
        folder={openFolder}
        media={folderModalMedia}
        onClose={() => {
          setOpenFolder(null);
          openFolderRef.current = null; // Clean up khi đóng thủ công
        }}
        onEditMedia={(m) => {
          setOpenFolder(null);
          openFolderRef.current = null; // Clean up vì chuyển sang edit panel
          openEditPanel({
            id: m.id,
            type: "media",
            title: m.title,
            url: m.url,
            thumbnail_url: m.thumbnail_url,
            alt: m.alt,
            is_active: m.is_active,
            media_type: m.media_type,
            source_type: m.source_type
          });
        }}
        onDeleteMedia={handleDeleteMedia}
        onReorderMedia={handleReorderMediaInFolder}
        onAddMedia={(node) => {
          // Tắt folder modal tạm thời, giữ ref để restore sau
          setOpenFolder(null);
          setAddingMediaTo(node);
        }}
      />

    </Page>
  );
}
export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);