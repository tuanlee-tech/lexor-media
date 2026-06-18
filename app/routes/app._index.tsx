import { useEffect, useState, useCallback, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Button, TextField, Box, Badge, Divider, Icon } from "@shopify/polaris";
import { FolderIcon, FileIcon, ImageIcon, CheckCircleIcon, PlusIcon, EditIcon, DeleteIcon } from "@shopify/polaris-icons";

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

import type { StructureNode, EditDrawerData, AddingState, AddChildType, MediaItemLocal } from "../components/structure/types";
import { TreeNodePolaris } from "../components/structure/TreeNodePolaris";
import { SortableTreeNode } from "../components/structure/SortableTreeNode";
import { EditPanelPolaris } from "../components/structure/EditPanelPolaris";
import { AddMediaModalPolaris, type AddMediaResult } from "../components/structure/AddMediaModalPolaris";
import { MediaGridPolaris } from "../components/structure/MediaGridPolaris";

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

function buildTree(cats: Category[], subs: SubCategory[], flds: Folder[], allMedia: MediaItem[]): StructureNode[] {
  const subsByCat = new Map<string, SubCategory[]>();
  subs.forEach(s => { const arr = subsByCat.get(s.category_id) || []; arr.push(s); subsByCat.set(s.category_id, arr); });

  const fldsBySub = new Map<string, Folder[]>();
  flds.forEach(f => { const arr = fldsBySub.get(f.sub_category_id) || []; arr.push(f); fldsBySub.set(f.sub_category_id, arr); });

  return cats.sort((a, b) => a.sort_order - b.sort_order).map(cat => ({
    id: cat.id, type: "category", title: cat.title, handle: cat.handle, parent_id: null,
    sort_order: cat.sort_order, is_active: parseBool(cat.is_active),
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
        const files = JSON.parse(filesJson) as AddMediaResult[];

        await Promise.allSettled(files.map(file => {
          return api.createMediaItem({
            category_id: categoryId || "",
            sub_category_id: subCategoryId || "",
            folder_id: folderId,
            media_type: file.media_type,
            source_type: file.type === "shopify" ? "shopify" : file.type === "youtube" ? "youtube" : "external",
            url: file.url,
            thumbnail_url: file.thumbnail_url || null,
            title: file.title || "Media",
            alt: file.alt || "",
            width: 0, height: 0, duration: 0,
            is_active: true
          });
        }));
        return { success: true };
      }
      case "reorder": {
        const resource = formData.get("resource") as "categories" | "sub-categories" | "folders" | "media";
        const itemsJson = formData.get("items") as string;
        const items = JSON.parse(itemsJson) as Array<{ id: string; sort_order: number }>;
        await api.bulkUpdateSortOrder(resource, items);
        return { success: true };
      }
      default: return { success: false, error: "Unknown intent" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Action failed" };
  }
};

export default function StructurePage() {
  const { categories, subCategories, folders, media, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const tree = useMemo(() => buildTree(categories, subCategories, folders, media), [categories, subCategories, folders, media]);

  // Local tree state for optimistic reordering
  const [localTree, setLocalTree] = useState<StructureNode[]>(tree);
  useEffect(() => { setLocalTree(tree); }, [tree]);

  const [search, setSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingData, setEditingData] = useState<EditDrawerData | null>(null);
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
  }, [fetcher]);

  const handleDelete = useCallback((id: string, type: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      fetcher.submit({ intent: "delete", type, id }, { method: "POST" });
      if (editingData?.id === id) setEditingData(null);
    }
  }, [fetcher, editingData]);

  const handleDeleteMedia = useCallback((id: string) => {
    if (confirm("Remove this media?")) {
      fetcher.submit({ intent: "delete_media", id }, { method: "POST" });
      if (editingData?.id === id) setEditingData(null);
    }
  }, [fetcher, editingData]);

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
    fetcher.submit(data, { method: "POST" });
  };

  // --- Drag & Drop handler ---
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

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
        // Check if this level contains the active node
        if (nodes.some(n => n.id === activeId)) {
          return arrayMove(nodes, nodes.findIndex(n => n.id === activeId), nodes.findIndex(n => n.id === overId))
            .map((n, i) => ({ ...n, sort_order: i * 10 }));
        }
        // Recurse into children
        return nodes.map(n => ({ ...n, children: applyReorder(n.children) }));
      };
      return applyReorder(prev);
    });

    // Persist to backend
    fetcher.submit(
      { intent: "reorder", resource, items: JSON.stringify(sortUpdates) },
      { method: "POST" }
    );
  }, [localTree, fetcher]);

  const renderChildNode = (child: StructureNode, depth: number) => {
    const nodeMedia = (media.filter(m => 
      (child.type === "category" && m.category_id === child.id && !m.sub_category_id && !m.folder_id) ||
      (child.type === "sub_category" && m.sub_category_id === child.id && !m.folder_id) ||
      (child.type === "folder" && m.folder_id === child.id)
    ).map(m => ({ ...m, is_active: parseBool(m.is_active) })) as MediaItemLocal[]).map(m => {
      if (editingData?.type === "media" && editingData.id === m.id) {
        return {
          ...m,
          thumbnail_url: editingData.thumbnail_url !== undefined ? editingData.thumbnail_url : m.thumbnail_url,
          is_active: editingData.is_active !== undefined ? parseBool(editingData.is_active) : m.is_active,
          media_type: editingData.media_type !== undefined ? (editingData.media_type as "image"|"video") : m.media_type
        };
      }
      return m;
    });

    // Wrap children in SortableContext so children of this node can be reordered
    const childIds = child.children.map(c => c.id);

    return (
      <div key={child.id}>
        <SortableTreeNode
          node={child} depth={depth} expandedNodes={expandedNodes} toggleExpand={toggleExpand}
          onEdit={(node) => setEditingData({ id: node.id, type: node.type, title: node.title, handle: node.handle, is_active: node.is_active, description: node.description, cover_image_url: node.cover_image_url })}
          onAddChild={(pid, ptype, ctype) => setAddingState({ parentId: pid, parentType: ptype, childType: ctype, grandparentId: child.parent_id })}
          onAddMedia={(node) => setAddingMediaTo(node)} onDelete={handleDelete} isSubmitting={isSubmitting}
          renderChildNode={(c, d) => renderSortableChildren(child, c, d)}
          addingState={addingState} newTitle={newTitle} setNewTitle={setNewTitle} submitCreate={submitCreate} cancelCreate={() => setAddingState(null)}
          isActiveEdit={editingData?.id === child.id}
        />
        {expandedNodes.has(child.id) && nodeMedia.length > 0 && (
          <MediaGridPolaris
            media={nodeMedia} depth={depth} onDelete={handleDeleteMedia}
            onEdit={(m) => setEditingData({ id: m.id, type: "media", title: m.title, url: m.url, thumbnail_url: m.thumbnail_url, alt: m.alt, is_active: m.is_active, media_type: m.media_type, source_type: m.source_type })}
            activeMediaId={editingData?.id}
          />
        )}
        {expandedNodes.has(child.id) && child.children.length === 0 && nodeMedia.length === 0 && (
          <div style={{ paddingLeft: `${12 + (depth + 1) * 24 + 48}px`, paddingBottom: "12px", paddingTop: "8px" }}>
            <Button size="micro" onClick={() => setAddingMediaTo(child)}>
              Add Media
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Renders children of a node wrapped in SortableContext
  const renderSortableChildren = (parent: StructureNode, child: StructureNode, depth: number) => {
    return renderChildNode(child, depth);
  };

  // Top-level category IDs for root SortableContext
  const rootIds = localTree.map(n => n.id);

  return (
    <Page
      title="Structure"
      primaryAction={{
        content: "Add Category",
        icon: PlusIcon,
        onAction: () => { setAddingState({ parentId: "root", parentType: "category", childType: "category" }); setNewTitle(""); },
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
                    <Button onClick={() => { setAddingState({ parentId: "root", parentType: "category", childType: "category" }); setNewTitle(""); }}>Add the first category</Button>
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
              onClose={() => setEditingData(null)}
              onSave={handleEditSave}
              onChange={(newData) => setEditingData(newData)}
              isSubmitting={isSubmitting}
            />
          </Layout.Section>
        )}
      </Layout>

      <AddMediaModalPolaris
        open={!!addingMediaTo}
        onClose={() => setAddingMediaTo(null)}
        onSubmit={(items) => { submitBulkMedia(addingMediaTo!, items); setAddingMediaTo(null); }}
        isSubmitting={isSubmitting}
      />
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
