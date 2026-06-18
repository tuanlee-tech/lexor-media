/**
 * EditDrawer — Right-side drawer for editing node or media details.
 * Supports Category, Sub Category, Folder, and Media types.
 */
import { useEffect, useState } from "react";
import type { EditDrawerData } from "./types";

interface EditDrawerProps {
  data: EditDrawerData | null;
  onClose: () => void;
  onSave: (data: EditDrawerData) => void;
  isSubmitting: boolean;
}

export function EditDrawer({ data, onClose, onSave, isSubmitting }: EditDrawerProps) {
  const [form, setForm] = useState<EditDrawerData | null>(null);

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  if (!data || !form) return null;

  const typeLabel = form.type === "category" ? "Category" :
    form.type === "sub_category" ? "Sub Category" :
    form.type === "folder" ? "Folder" : "Media";

  const update = (field: string, value: any) => {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "420px",
      background: "var(--p-color-bg-surface)", borderLeft: "1px solid var(--p-color-border)",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.08)", zIndex: 999, display: "flex",
      flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--p-color-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>Edit {typeLabel}</div>
          <div style={{ fontSize: "12px", color: "var(--p-color-text-secondary)", marginTop: "2px" }}>
            ID: {form.id.slice(0, 8)}…
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", fontSize: "20px", cursor: "pointer",
          color: "var(--p-color-text-secondary)", padding: "4px",
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {/* Title */}
        <FieldGroup label="Title">
          <input type="text" value={form.title} onChange={e => update("title", e.target.value)}
            style={inputStyle} />
        </FieldGroup>

        {/* Handle (readonly for reference) */}
        {form.handle !== undefined && (
          <FieldGroup label="Handle (URL slug)">
            <input type="text" value={form.handle || ""} readOnly
              style={{ ...inputStyle, background: "#f6f6f7", color: "#6d7175" }} />
          </FieldGroup>
        )}

        {/* Description (Folder / Media) */}
        {(form.type === "folder" || form.type === "media") && (
          <FieldGroup label="Description">
            <textarea value={form.description || ""} onChange={e => update("description", e.target.value)}
              rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </FieldGroup>
        )}

        {/* Alt text (Media) */}
        {form.type === "media" && (
          <FieldGroup label="Alt Text">
            <input type="text" value={form.alt || ""} onChange={e => update("alt", e.target.value)}
              style={inputStyle} placeholder="Describe this media for accessibility" />
          </FieldGroup>
        )}

        {/* URL (Media) */}
        {form.type === "media" && form.url && (
          <FieldGroup label="URL">
            <input type="text" value={form.url} onChange={e => update("url", e.target.value)}
              style={inputStyle} />
          </FieldGroup>
        )}

        {/* Thumbnail URL */}
        {form.type === "media" && (
          <FieldGroup label="Thumbnail URL">
            <input type="text" value={form.thumbnail_url || ""} onChange={e => update("thumbnail_url", e.target.value)}
              style={inputStyle} placeholder="Optional custom thumbnail" />
            {form.thumbnail_url && (
              <img src={form.thumbnail_url} alt="thumb" style={{ marginTop: "8px", maxWidth: "100%", maxHeight: "120px", borderRadius: "6px", objectFit: "cover" }} />
            )}
          </FieldGroup>
        )}

        {/* Cover image (Folder) */}
        {form.type === "folder" && (
          <FieldGroup label="Cover Image URL">
            <input type="text" value={form.cover_image_url || ""} onChange={e => update("cover_image_url", e.target.value)}
              style={inputStyle} placeholder="Optional cover image" />
            {form.cover_image_url && (
              <img src={form.cover_image_url} alt="cover" style={{ marginTop: "8px", maxWidth: "100%", maxHeight: "120px", borderRadius: "6px", objectFit: "cover" }} />
            )}
          </FieldGroup>
        )}

        {/* Source Type (Media — read-only) */}
        {form.type === "media" && form.source_type && (
          <FieldGroup label="Source">
            <div style={{ fontSize: "13px", padding: "8px 12px", background: "#f6f6f7", borderRadius: "6px" }}>
              {form.source_type === "shopify" ? "📦 Shopify Files" :
               form.source_type === "youtube" ? "▶ YouTube" : "🌐 External URL"}
            </div>
          </FieldGroup>
        )}

        {/* Active toggle */}
        <FieldGroup label="Status">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => update("is_active", e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#1a1a1a" }} />
            {form.is_active ? "Active" : "Inactive"}
          </label>
        </FieldGroup>
      </div>

      {/* Footer */}
      <div style={{
        padding: "16px 20px", borderTop: "1px solid var(--p-color-border)",
        display: "flex", gap: "8px", justifyContent: "flex-end",
      }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={isSubmitting} style={primaryBtnStyle}>
          {isSubmitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--p-color-text)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "8px",
  border: "1px solid var(--p-color-border)", fontSize: "13px",
  outline: "none", boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px", background: "#1a1a1a", color: "white",
  border: "none", borderRadius: "8px", cursor: "pointer",
  fontSize: "13px", fontWeight: 600,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px", background: "var(--p-color-bg-surface-secondary)",
  border: "1px solid var(--p-color-border)", borderRadius: "8px",
  cursor: "pointer", fontSize: "13px",
};
