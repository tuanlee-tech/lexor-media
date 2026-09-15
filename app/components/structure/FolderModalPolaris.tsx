/**
 * FolderModalPolaris — Modal displaying media items inside a folder.
 * Supports drag-and-drop reordering of media within the folder.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Modal,
  Text,
  Box,
  BlockStack,
  InlineStack,
  Button,
  Icon,
  Tooltip,
} from "@shopify/polaris";
import {
  PlusIcon,
  PlayIcon,
  DeleteIcon,
  ImageIcon,
  EditIcon,
} from "@shopify/polaris-icons";
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaItemLocal, StructureNode } from "./types";
import { compareMediaDates } from "../../lib/media-date";

interface Props {
  open: boolean;
  folder: StructureNode | null;
  media: MediaItemLocal[];
  onClose: () => void;
  onEditMedia: (m: MediaItemLocal) => void;
  onDeleteMedia: (id: string) => void;
  onReorderMedia: (folderId: string, items: Array<{ id: string; sort_order: number }>) => void;
  onAddMedia: (folder: StructureNode) => void;
}

// ── Sortable Media Card for Modal ─────────────────────────────

function SortableModalMediaCard({
  media,
  isSelected,
  onEdit,
  onDelete,
}: {
  media: MediaItemLocal;
  isSelected: boolean;
  onEdit: (m: MediaItemLocal) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : media.is_active ? 1 : 0.5,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: "relative",
        width: "100px",
        height: "100px",
        borderRadius: "10px",
        overflow: "hidden",
        border: isSelected
          ? "2px solid #1a1a1a"
          : "1px solid var(--p-color-border)",
        boxShadow: isDragging
          ? "0 4px 12px rgba(0,0,0,0.15)"
          : "none",
        cursor: isDragging ? "grabbing" : "grab",
        background: "#f6f6f7",
        touchAction: "none",
      }}
      onClick={() => onEdit(media)}
      {...attributes}
      {...listeners}
    >
      {media.thumbnail_url ? (
        <img
          src={media.thumbnail_url}
          alt={media.alt || media.title}
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
            fontSize: "28px",
          }}
        >
          {media.media_type === "video" ? "🎬" : "📷"}
        </div>
      )}

      {/* Media Type Badge */}
      <div
        style={{
          position: "absolute",
          bottom: "4px",
          left: "4px",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "50%",
          padding: "2px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        {media.media_type === "video" ? (
          <Icon source={PlayIcon} tone="base" />
        ) : (
          <Icon source={ImageIcon} tone="base" />
        )}
      </div>

      {/* Hidden Badge */}
      {!media.is_active && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          HIDDEN
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="modal-media-actions"
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
            onClick={(e) => {
              e.stopPropagation();
              onEdit(media);
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              onDelete(media.id);
            }}
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

// ── Main Modal Component ──────────────────────────────────────

export function FolderModalPolaris({
  open,
  folder,
  media,
  onClose,
  onEditMedia,
  onDeleteMedia,
  onReorderMedia,
  onAddMedia,
}: Props) {
  // Local state for optimistic reordering inside modal
  const [localMedia, setLocalMedia] = useState<MediaItemLocal[]>(media);


  useEffect(() => {
    setLocalMedia([...media].sort(compareMediaDates));
  }, [media]);

  const displayMedia = useMemo(() => {
    return [...localMedia].sort(compareMediaDates);
  }, [localMedia]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const oldIndex = displayMedia.findIndex((m) => m.id === activeId);
      const newIndex = displayMedia.findIndex((m) => m.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      if ((displayMedia[oldIndex].media_date || "") !== (displayMedia[newIndex].media_date || "")) return;

      const reordered = arrayMove(displayMedia, oldIndex, newIndex);
      const sortUpdates = reordered.map((m, i) => ({
        id: m.id,
        sort_order: i * 10,
      }));

      // Optimistic update
      const updatedMedia = reordered.map((m, i) => ({
        ...m,
        sort_order: i * 10,
      }));
      setLocalMedia(updatedMedia);

      // Persist
      if (folder) {
        onReorderMedia(folder.id, sortUpdates);
      }
    },
    [displayMedia, folder, onReorderMedia]
  );

  if (!folder) return null;

  const mediaIds = displayMedia.map((m) => m.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={folder.title}
      size="large"
      primaryAction={{
        content: "Add Media",
        icon: PlusIcon,
        onAction: () => onAddMedia(folder),
      }}
      secondaryActions={[
        {
          content: "Close",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <Text as="p" tone="subdued">Newest dates first. Drag to reorder files with the same date. Undated files appear last.</Text>
        <Box paddingBlockEnd="400">
          {displayMedia.length === 0 ? (
            <Box padding="600">
              <BlockStack
                align="center"
                inlineAlign="center"
                gap="300"
              >
                <Text as="p" tone="subdued">
                  This folder is empty.
                </Text>
                <Button
                  icon={PlusIcon}
                  onClick={() => onAddMedia(folder)}
                >
                  Add Media
                </Button>
              </BlockStack>
            </Box>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={mediaIds}
                strategy={rectSortingStrategy}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  {displayMedia.map((m) => (
                    <SortableModalMediaCard
                      key={m.id}
                      media={m}
                      isSelected={false}
                      onEdit={onEditMedia}
                      onDelete={onDeleteMedia}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Box>
      </Modal.Section>

      {/* Hover styles */}
      <style>{`
        .modal-media-actions { opacity: 0; transition: opacity 0.2s; }
        div:hover > .modal-media-actions { opacity: 1; }
      `}</style>
    </Modal>
  );
}
