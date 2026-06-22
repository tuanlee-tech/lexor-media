/**
 * ContentGridPolaris — Unified grid displaying both Folders and Media as 1:1 cards.
 * Enables drag-and-drop reordering between folders and media in a single SortableContext.
 */

import { Box, Icon, Text, Tooltip, Badge } from "@shopify/polaris";
import {
  FolderIcon,
  PlayIcon,
  DeleteIcon,
  ImageIcon,
  EditIcon,
} from "@shopify/polaris-icons";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaItemLocal, StructureNode } from "./types";

// ── Unified Content Item ──────────────────────────────────────

export interface ContentGridItem {
  /** Prefixed ID: `folder_${id}` or `media_${id}` */
  id: string;
  type: "folder" | "media";
  title: string;
  sort_order: number;
  is_active: boolean;
  // Media-specific fields
  thumbnail_url?: string | null;
  media_type?: "image" | "video";
  alt?: string | null;
  // Folder-specific fields
  media_count?: number;
  cover_image_url?: string | null;
  description?: string | null;
  // Original references for callbacks
  originalFolder?: StructureNode;
  originalMedia?: MediaItemLocal;
}

interface Props {
  items: ContentGridItem[];
  onEditMedia: (m: MediaItemLocal) => void;
  onEditFolder: (node: StructureNode) => void;
  onOpenFolder: (node: StructureNode) => void;
  onDeleteMedia: (id: string) => void;
  onDeleteFolder: (id: string, title: string) => void;
  depth: number;
  activeId?: string | null;
}

// ── Sortable Card Component ───────────────────────────────────

function SortableContentCard({
  item,
  isSelected,
  onEditMedia,
  onEditFolder,
  onOpenFolder,
  onDeleteMedia,
  onDeleteFolder,
}: {
  item: ContentGridItem;
  isSelected: boolean;
  onEditMedia: (m: MediaItemLocal) => void;
  onEditFolder: (node: StructureNode) => void;
  onOpenFolder: (node: StructureNode) => void;
  onDeleteMedia: (id: string) => void;
  onDeleteFolder: (id: string, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : item.is_active ? 1 : 0.5,
  };

  const isFolder = item.type === "folder";

  const handleClick = () => {
    if (isFolder) {
      if (item.originalFolder) onOpenFolder(item.originalFolder);
    } else {
      if (item.originalMedia) onEditMedia(item.originalMedia);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      if (item.originalFolder) onEditFolder(item.originalFolder);
    } else {
      if (item.originalMedia) onEditMedia(item.originalMedia);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onDeleteFolder(item.originalFolder!.id, item.title);
    } else {
      onDeleteMedia(item.originalMedia!.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: "relative",
        width: "96px",
        height: "96px",
        borderRadius: "10px",
        overflow: "hidden",
        border: isSelected
          ? "2px solid #1a1a1a"
          : "1px solid var(--p-color-border)",
        boxShadow: isSelected
          ? "0 0 0 2px rgba(0,0,0,0.1)"
          : isDragging
            ? "0 4px 12px rgba(0,0,0,0.15)"
            : "none",
        cursor: isDragging ? "grabbing" : "grab",
        background: isFolder ? "var(--p-color-bg-surface-secondary)" : "#f6f6f7",
        touchAction: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={handleClick}
      {...attributes}
      {...listeners}
    >
      {isFolder ? (
        /* ── Folder Card ── */
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              width: "100%",
            }}
          >
            {item.cover_image_url ? (
              <img
                src={item.cover_image_url}
                alt={item.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon source={FolderIcon} tone="subdued" />
              </div>
            )}
          </div>

          {/* Folder Label */}
          <div
            style={{
              width: "100%",
              padding: "3px 4px",
              background: "rgba(0,0,0,0.05)",
              borderTop: "1px solid var(--p-color-border)",
              textAlign: "center",
            }}
          >
            <Text
              as="span"
              variant="bodyXs"
              fontWeight="medium"
              truncate
              tone={item.is_active ? undefined : "subdued"}
            >
              {item.title}
            </Text>
          </div>

          {/* Media Count Badge */}
          {item.media_count !== undefined && item.media_count > 0 && (
            <div
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
              }}
            >
              <Badge size="small" tone="info">
                {String(item.media_count)}
              </Badge>
            </div>
          )}
        </>
      ) : (
        /* ── Media Card ── */
        <>
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.alt || item.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
              }}
            >
              {item.media_type === "video" ? (
                <div style={{ fontSize: "24px" }}>🎬</div>
              ) : (
                <Icon source={ImageIcon} tone="subdued" />
              )}
            </div>
          )}

          {/* Video Badge */}
          {item.media_type === "video" && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "4px",
                background: "rgba(255,255,255,0.9)",
                borderRadius: "50%",
                padding: "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              <Icon source={PlayIcon} tone="base" />
            </div>
          )}

          {/* Type Badge */}
          {item.media_type === "image" && (
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "4px",
                background: "rgba(255,255,255,0.9)",
                borderRadius: "50%",
                padding: "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              <Icon source={ImageIcon} tone="base" />
            </div>
          )}
        </>
      )}

      {/* Action Buttons — only visible on hover */}
      <div
        className="content-card-actions"
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          display: "flex",
          gap: "2px",
        }}
      >
        <Tooltip content="Edit">
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleEdit}
            style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "50%",
              padding: "2px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon source={EditIcon} tone="base" />
          </div>
        </Tooltip>
        <Tooltip content="Delete">
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "50%",
              padding: "2px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--p-color-text-critical)",
            }}
          >
            <Icon source={DeleteIcon} />
          </div>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Main Grid Component ───────────────────────────────────────

export function ContentGridPolaris({
  items,
  onEditMedia,
  onEditFolder,
  onOpenFolder,
  onDeleteMedia,
  onDeleteFolder,
  depth,
  activeId,
}: Props) {
  if (!items.length) return null;

  const indent = depth * 24;

  return (
    <Box paddingBlockEnd="300">
      <div style={{ paddingLeft: `${12 + indent + 48}px` }}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            {items.map((item) => (
              <SortableContentCard
                key={item.id}
                item={item}
                isSelected={item.id === `media_${activeId}` || item.id === `folder_${activeId}`}
                onEditMedia={onEditMedia}
                onEditFolder={onEditFolder}
                onOpenFolder={onOpenFolder}
                onDeleteMedia={onDeleteMedia}
                onDeleteFolder={onDeleteFolder}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Hover styles for action buttons */}
      <style>{`
        .content-card-actions { opacity: 0; transition: opacity 0.2s; }
        div:hover > .content-card-actions { opacity: 1; }
      `}</style>
    </Box>
  );
}