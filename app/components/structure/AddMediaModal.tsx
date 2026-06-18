/**
 * AddMediaModal — Modal with tabs for Shopify Files, External URL, YouTube.
 */
import { useState } from "react";

export interface AddMediaResult {
  type: "shopify" | "external" | "youtube";
  url: string;
  thumbnail_url?: string;
  title: string;
  alt?: string;
  media_type: "image" | "video";
}

interface AddMediaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (items: AddMediaResult[]) => void;
  onBrowseShopify: () => void;
  isSubmitting: boolean;
}

export function AddMediaModal({ open, onClose, onSubmit, onBrowseShopify, isSubmitting }: AddMediaModalProps) {
  const [tab, setTab] = useState<"shopify" | "external" | "youtube">("shopify");
  const [extUrl, setExtUrl] = useState("");
  const [extThumb, setExtThumb] = useState("");
  const [extTitle, setExtTitle] = useState("");
  const [extType, setExtType] = useState<"image" | "video">("image");
  const [ytUrl, setYtUrl] = useState("");
  const [ytTitle, setYtTitle] = useState("");

  if (!open) return null;

  const tabs = [
    { key: "shopify" as const, label: "📦 Shopify Files" },
    { key: "external" as const, label: "🌐 External URL" },
    { key: "youtube" as const, label: "▶ YouTube" },
  ];

  const submitExternal = () => {
    if (!extUrl.trim()) return;
    onSubmit([{
      type: "external",
      url: extUrl.trim(),
      thumbnail_url: extThumb.trim() || undefined,
      title: extTitle.trim() || "External Media",
      media_type: extType,
    }]);
    setExtUrl(""); setExtThumb(""); setExtTitle("");
  };

  const extractYoutubeId = (url: string): string => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || "";
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex(p => ["embed", "shorts"].includes(p));
      return idx >= 0 ? parts[idx + 1] || "" : "";
    } catch { return ""; }
  };

  const submitYoutube = () => {
    if (!ytUrl.trim()) return;
    const ytId = extractYoutubeId(ytUrl);
    onSubmit([{
      type: "youtube",
      url: ytUrl.trim(),
      thumbnail_url: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined,
      title: ytTitle.trim() || `YouTube Video`,
      media_type: "video",
    }]);
    setYtUrl(""); setYtTitle("");
  };

  const ytPreviewId = extractYoutubeId(ytUrl);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
      }} />

      {/* Modal */}
      <div style={{
        position: "relative", width: "560px", maxHeight: "80vh", background: "var(--p-color-bg-surface)",
        borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex",
        flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--p-color-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "16px", fontWeight: 600 }}>Add Media</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: "20px", cursor: "pointer",
            color: "var(--p-color-text-secondary)",
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--p-color-border)" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "10px", background: tab === t.key ? "var(--p-color-bg-surface)" : "var(--p-color-bg-surface-secondary)",
              border: "none", borderBottom: tab === t.key ? "2px solid #1a1a1a" : "2px solid transparent",
              cursor: "pointer", fontSize: "13px", fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "#1a1a1a" : "var(--p-color-text-secondary)",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "20px", flex: 1, overflow: "auto" }}>
          {tab === "shopify" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: "14px", marginBottom: "16px", color: "var(--p-color-text-secondary)" }}>
                Browse and select files directly from your Shopify Files library.
              </p>
              <button onClick={() => { onBrowseShopify(); onClose(); }} style={{
                padding: "12px 28px", background: "#1a1a1a", color: "white",
                border: "none", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: 600,
              }}>
                📂 Browse Shopify Files
              </button>
            </div>
          )}

          {tab === "external" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Field label="URL *" value={extUrl} onChange={setExtUrl} placeholder="https://cdn.example.com/image.jpg" />
              <Field label="Title" value={extTitle} onChange={setExtTitle} placeholder="Media title" />
              <Field label="Thumbnail URL" value={extThumb} onChange={setExtThumb} placeholder="Optional thumbnail" />
              <div>
                <label style={labelStyle}>Type</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["image", "video"] as const).map(t => (
                    <button key={t} onClick={() => setExtType(t)} style={{
                      padding: "6px 16px", borderRadius: "6px", cursor: "pointer",
                      border: extType === t ? "2px solid #1a1a1a" : "1px solid var(--p-color-border)",
                      background: extType === t ? "#1a1a1a" : "transparent",
                      color: extType === t ? "white" : "var(--p-color-text)",
                      fontSize: "13px", fontWeight: extType === t ? 600 : 400,
                    }}>{t === "image" ? "📷 Image" : "🎥 Video"}</button>
                  ))}
                </div>
              </div>
              {extThumb && (
                <img src={extThumb} alt="preview" style={{ maxWidth: "100%", maxHeight: "120px", borderRadius: "6px", objectFit: "cover" }} />
              )}
              <button onClick={submitExternal} disabled={!extUrl.trim() || isSubmitting} style={{
                padding: "10px", background: extUrl.trim() ? "#1a1a1a" : "#ccc", color: "white",
                border: "none", borderRadius: "8px", cursor: extUrl.trim() ? "pointer" : "not-allowed",
                fontSize: "13px", fontWeight: 600, marginTop: "4px",
              }}>Add External Media</button>
            </div>
          )}

          {tab === "youtube" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Field label="YouTube URL *" value={ytUrl} onChange={setYtUrl} placeholder="https://www.youtube.com/watch?v=..." />
              <Field label="Title" value={ytTitle} onChange={setYtTitle} placeholder="Video title (auto-detected if empty)" />
              {ytPreviewId && (
                <div>
                  <label style={labelStyle}>Preview</label>
                  <img src={`https://img.youtube.com/vi/${ytPreviewId}/hqdefault.jpg`} alt="yt preview"
                    style={{ width: "100%", maxHeight: "200px", borderRadius: "6px", objectFit: "cover" }} />
                </div>
              )}
              <button onClick={submitYoutube} disabled={!ytUrl.trim() || isSubmitting} style={{
                padding: "10px", background: ytUrl.trim() ? "#1a1a1a" : "#ccc", color: "white",
                border: "none", borderRadius: "8px", cursor: ytUrl.trim() ? "pointer" : "not-allowed",
                fontSize: "13px", fontWeight: 600, marginTop: "4px",
              }}>Add YouTube Video</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--p-color-border)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px",
};
