import { useState } from "react";
import type { StructureNode, AddingState } from "./types";

interface TreeNodeProps {
  node: StructureNode;
  depth?: number;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (node: StructureNode) => void;
  onAddChild: (parentId: string, parentType: "category" | "sub_category" | "folder", childType: "category" | "sub_category" | "folder") => void;
  onAddMedia: (node: StructureNode) => void;
  onDelete: (id: string, type: "category" | "sub_category" | "folder", title: string) => void;
  isSubmitting: boolean;
  renderChildNode: (child: StructureNode, depth: number) => React.ReactNode;
  addingState: AddingState | null;
  newTitle: string;
  setNewTitle: (t: string) => void;
  submitCreate: () => void;
  cancelCreate: () => void;
}

export function TreeNode({
  node, depth = 0, expandedNodes, toggleExpand, onEdit, onAddChild, onAddMedia, onDelete,
  isSubmitting, renderChildNode, addingState, newTitle, setNewTitle, submitCreate, cancelCreate
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const indent = depth * 24;

  const typeIcon = node.type === "category" ? "📁" : node.type === "sub_category" ? "📂" : "📄";
  
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div key={node.id}>
      <div
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
          paddingLeft: `${12 + indent}px`, borderBottom: "1px solid var(--p-color-border-secondary)",
          opacity: node.is_active ? 1 : 0.5,
          position: "relative"
        }}
      >
        {node.type !== "folder" ? (
          <button
            onClick={() => toggleExpand(node.id)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px",
              fontSize: "14px", color: "var(--p-color-text-secondary)",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 150ms", width: "20px", flexShrink: 0,
            }}
          >▶</button>
        ) : <span style={{ width: "20px", flexShrink: 0 }} />}

        <span style={{ fontSize: "16px", flexShrink: 0 }}>{typeIcon}</span>

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: depth === 0 ? 600 : 400, fontSize: "13px" }}>{node.title}</span>
          {node.media_count !== undefined && node.media_count > 0 && (
            <span style={{ fontSize: "11px", color: "var(--p-color-text-secondary)", background: "var(--p-color-bg-surface-secondary)", padding: "2px 6px", borderRadius: "10px" }}>
              {node.media_count} media
            </span>
          )}
        </div>

        {/* Hover Actions */}
        {menuOpen && (
          <div style={{ display: "flex", gap: "4px", flexShrink: 0, background: "var(--p-color-bg-surface)", paddingLeft: "8px" }}>
            <button onClick={() => onEdit(node)} style={actionBtnStyle} title="Edit">✏</button>
            <button onClick={() => onAddMedia(node)} style={actionBtnStyle} title="Add Media">📎</button>
            {node.type !== "folder" && (
              <button 
                onClick={() => onAddChild(node.id, node.type, node.type === "category" ? "sub_category" : "folder")} 
                style={actionBtnStyle} title="Add Child"
              >➕</button>
            )}
            <button onClick={() => onDelete(node.id, node.type, node.title)} style={actionBtnStyle} title="Delete">🗑</button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div>
          {/* Inline Add Form */}
          {addingState?.parentId === node.id && (
            <div style={{
              display: "flex", gap: "6px", padding: "8px 12px", paddingLeft: `${36 + indent}px`,
              borderBottom: "1px solid var(--p-color-border-secondary)", background: "var(--p-color-bg-surface-secondary)",
            }}>
              <input
                type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); if (e.key === "Escape") cancelCreate(); }}
                placeholder={`New ${addingState.childType.replace("_", " ")} title…`} autoFocus
                style={{ flex: 1, padding: "4px 8px", border: "1px solid var(--p-color-border)", borderRadius: "6px", fontSize: "13px", outline: "none" }}
              />
              <button onClick={submitCreate} disabled={isSubmitting || !newTitle.trim()} style={{ padding: "4px 10px", background: "var(--p-color-bg-fill-success)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Add</button>
              <button onClick={cancelCreate} style={{ padding: "4px 10px", background: "var(--p-color-bg-surface-secondary)", border: "1px solid var(--p-color-border)", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
            </div>
          )}

          {/* Render Children Recursively */}
          {node.children.map(child => renderChildNode(child, depth + 1))}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: "var(--p-color-bg-surface-secondary)", border: "1px solid var(--p-color-border)",
  cursor: "pointer", padding: "4px 8px", fontSize: "12px", borderRadius: "4px", lineHeight: 1, color: "var(--p-color-text)"
};
