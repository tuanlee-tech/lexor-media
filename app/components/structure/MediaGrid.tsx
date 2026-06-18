import type { MediaItemLocal } from "./types";

interface MediaGridProps {
  media: MediaItemLocal[];
  onEdit: (m: MediaItemLocal) => void;
  onDelete: (id: string) => void;
  depth: number;
}

export function MediaGrid({ media, onEdit, onDelete, depth }: MediaGridProps) {
  if (!media.length) return null;
  
  const indent = depth * 24;

  return (
    <div style={{
      paddingLeft: `${12 + indent + 20}px`, paddingBottom: "12px",
      borderBottom: "1px solid var(--p-color-border-secondary)",
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px", marginBottom: "8px" }}>
        {media.map((m) => (
          <div key={m.id} style={{
            position: "relative", width: "60px", height: "60px", borderRadius: "6px",
            overflow: "hidden", border: "1px solid var(--p-color-border-secondary)", background: "#eee",
            cursor: "pointer"
          }}
          onClick={() => onEdit(m)}
          >
            {m.thumbnail_url ? (
              <img src={m.thumbnail_url} alt={m.alt || m.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "20px" }}>
                {m.media_type === "video" ? "🎬" : "📷"}
              </div>
            )}
            
            {m.media_type === "video" && (
              <div style={{ position: "absolute", bottom: "2px", right: "2px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "8px", padding: "1px 3px", borderRadius: "2px" }}>
                VID
              </div>
            )}
            
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
              style={{
                position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px",
                background: "rgba(255,0,0,0.8)", color: "white", border: "none", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", cursor: "pointer"
              }}
              title="Remove Media"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
