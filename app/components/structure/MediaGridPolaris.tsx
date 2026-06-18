import { Box, Tooltip, Icon, Button } from "@shopify/polaris";
import { PlayIcon, DeleteIcon, EditIcon, PlayCircleIcon, ImageIcon } from "@shopify/polaris-icons";
import type { MediaItemLocal } from "./types";

interface Props {
  media: MediaItemLocal[];
  onEdit: (m: MediaItemLocal) => void;
  onDelete: (id: string) => void;
  depth: number;
  activeMediaId?: string | null;
}

export function MediaGridPolaris({ media, onEdit, onDelete, depth, activeMediaId }: Props) {
  if (!media.length) return null;
  const indent = depth * 24;

  return (
    <Box paddingBlockEnd="300">
      <div style={{ paddingLeft: `${12 + indent + 48}px` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
          {media.map((m) => {
            const isSelected = m.id === activeMediaId;
            return (
              <div
                key={m.id}
                onClick={() => onEdit(m)}
                style={{
                  position: "relative",
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: isSelected ? "2px solid #1a1a1a" : "1px solid var(--p-color-border)",
                  boxShadow: isSelected ? "0 0 0 2px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  background: "#f6f6f7"
                }}
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

                {/* Delete Button (Show on hover or if active) */}
                <div
                  className="media-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: "50%",
                    padding: "2px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
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
          })}
        </div>
      </div>

      {/* Basic hover style for delete button */}
      <style>{`
        .media-delete-btn { opacity: 0; transition: opacity 0.2s; }
        div:hover > .media-delete-btn { opacity: 1; }
      `}</style>
    </Box>
  );
}
