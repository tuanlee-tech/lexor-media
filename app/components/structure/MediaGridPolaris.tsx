import { Box, Tooltip, Icon } from "@shopify/polaris";
import { PlayIcon, DeleteIcon, ImageIcon } from "@shopify/polaris-icons";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaItemLocal } from "./types";

interface Props {
  media: MediaItemLocal[];
  onEdit: (m: MediaItemLocal) => void;
  onDelete: (id: string) => void;
  depth: number;
  activeMediaId?: string | null;
}

function SortableMediaItem({ m, isSelected, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(m.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: "relative",
        width: "80px",
        height: "80px",
        borderRadius: "8px",
        overflow: "hidden",
        border: isSelected ? "2px solid #1a1a1a" : "1px solid var(--p-color-border)",
        boxShadow: isSelected ? "0 0 0 2px rgba(0,0,0,0.1)" : isDragging ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
        cursor: isDragging ? "grabbing" : "grab",
        background: "#f6f6f7",
        touchAction: "none"
      }}
      onClick={() => onEdit(m)}
      {...attributes}
      {...listeners}
    >
      {/* Media Image */}
      {m.thumbnail_url ? (
        <img
          src={m.thumbnail_url}
          alt={m.alt || m.title}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: m.is_active ? 1 : 0.4 }}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "24px" }}>
          {m.media_type === "video" ? "🎬" : "📷"}
        </div>
      )}

      {/* Video Badge */}
      <div style={{ boxShadow: "0px 4px 25px 6px rgba(0, 0, 0, 0.08)", position: "absolute", bottom: "4px", left: "2px", background: "rgba(255, 255, 255, 0.8)", borderRadius: "50%", padding: "2px", color: "white" }}>
        {m.media_type === "video" && (<Icon source={PlayIcon} tone="base" />)}
        {m.media_type === "image" && (<Icon source={ImageIcon} tone="base" />)}
      </div>

      {/* Inactive Badge */}
      {!m.is_active && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.7)", color: "white", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
          HIDDEN
        </div>
      )}

      {/* Delete Button */}
      <div
        className="media-delete-btn"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          background: "rgba(255,255,255,0.9)",
          borderRadius: "50%",
          padding: "2px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          cursor: "pointer"
        }}
      >
        <Tooltip content="Delete">
          <div style={{ color: "var(--p-color-text-critical)" }}>
            <Icon source={DeleteIcon} />
          </div>
        </Tooltip>
      </div>
    </div>
  );
}

export function MediaGridPolaris({ media, onEdit, onDelete, depth, activeMediaId }: Props) {
  if (!media.length) return null;
  const indent = depth * 24;
  const mediaIds = media.map((m) => String(m.id));

  return (
    <Box paddingBlockEnd="300">
      <div style={{ paddingLeft: `${12 + indent + 48}px` }}>
        <SortableContext items={mediaIds} strategy={rectSortingStrategy}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
            {media.map((m) => (
              <SortableMediaItem
                key={m.id}
                m={m}
                isSelected={m.id === activeMediaId}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <style>{`
        .media-delete-btn { opacity: 0; transition: opacity 0.2s; }
        div:hover > .media-delete-btn { opacity: 1; }
      `}</style>
    </Box>
  );
}
