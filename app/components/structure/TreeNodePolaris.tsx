/**
 * TreeNodePolaris — Polaris-styled tree node.
 *
 * Layout by node type:
 *  - category / sub_category: expandable row with chevron + icon + title
 *  - folder: NOT rendered as a tree row anymore (folders live inside ContentGrid)
 *
 * When a sub_category is expanded, its children (folders) are shown inside the
 * unified ContentGrid alongside media, NOT as nested tree rows.
 */

import { useState } from "react";
import {
  InlineStack,
  Text,
  Button,
  Box,
  Icon,
  Tooltip,
  Badge,
  TextField,
} from "@shopify/polaris";
import {
  PlusIcon,
  EditIcon,
  DeleteIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CategoriesIcon,
  CollectionFilledIcon,
  DragHandleIcon,
} from "@shopify/polaris-icons";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { StructureNode, AddingState } from "./types";

interface Props {
  node: StructureNode;
  depth?: number;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (node: StructureNode) => void;
  onAddChild: (
    parentId: string,
    parentType: "category" | "sub_category" | "folder",
    childType: "category" | "sub_category" | "folder"
  ) => void;
  onAddMedia: (node: StructureNode) => void;
  onDelete: (
    id: string,
    type: "category" | "sub_category" | "folder",
    title: string
  ) => void;
  isSubmitting: boolean;
  renderChildNode: (child: StructureNode, depth: number) => React.ReactNode;
  addingState: AddingState | null;
  newTitle: string;
  setNewTitle: (t: string) => void;
  submitCreate: () => void;
  cancelCreate: () => void;
  isActiveEdit: boolean;
  dragHandleProps?: Record<string, any>;
  renderMediaGrid?: () => React.ReactNode;
}

export function TreeNodePolaris({
  node,
  depth = 0,
  expandedNodes,
  toggleExpand,
  onEdit,
  onAddChild,
  onAddMedia,
  onDelete,
  isSubmitting,
  renderChildNode,
  addingState,
  newTitle,
  setNewTitle,
  submitCreate,
  cancelCreate,
  isActiveEdit,
  dragHandleProps,
  renderMediaGrid,
}: Props) {
  const isExpanded = expandedNodes.has(node.id);
  const indent = depth * 24;
  const [hovered, setHovered] = useState(false);

  const getIcon = () => {
    if (node.type === "category") return CategoriesIcon;
    return CollectionFilledIcon; // sub_category
  };

  // Defensive: folders should not render as tree rows (they live in ContentGrid)
  if (node.type === "folder") {
    return null;
  }

  return (
    <Box>
      {/* ── Tree Row ── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          minHeight: "48px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          paddingLeft: `${12 + indent}px`,
          borderBottom: "1px solid var(--p-color-border-secondary)",
          background: isActiveEdit
            ? "var(--p-color-bg-surface-selected)"
            : hovered
              ? "var(--p-color-bg-surface-hover)"
              : "transparent",
          opacity: node.is_active ? 1 : 0.6,
          cursor: "pointer",
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          toggleExpand(node.id);
        }}
      >
        {/* Drag Handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            style={{
              cursor: "grab",
              color: "var(--p-color-text-secondary)",
              display: "flex",
              alignItems: "center",
              touchAction: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon source={DragHandleIcon} />
          </div>
        )}

        {/* Expand/Collapse Chevron */}
        <div
          style={{
            width: "24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            style={{
              cursor: "pointer",
              color: "var(--p-color-text-secondary)",
            }}
          >
            <Icon
              source={isExpanded ? ChevronDownIcon : ChevronRightIcon}
            />
          </div>
        </div>

        {/* Type Icon */}
        <div style={{ color: "var(--p-color-text-secondary)" }}>
          <Icon source={getIcon()} />
        </div>

        {/* Title + Badges */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Text as="span" fontWeight={depth === 0 ? "bold" : "regular"}>
            {node.title}
          </Text>
          {node.media_count !== undefined && node.media_count > 0 && (
            <Badge size="small" tone="info">{`${node.media_count} media`}</Badge>
          )}
          {node.children.length > 0 && node.type === "sub_category" && (
            <Badge size="small" tone="success">{`${node.children.length} folders`}</Badge>
          )}
          {!node.is_active && (
            <Badge size="small" tone="critical">
              Hidden
            </Badge>
          )}
        </div>

        {/* Hover Actions */}
        {hovered && (
          <InlineStack gap="100" wrap={false}>
            <Tooltip content="Edit">
              <Button
                size="micro"
                icon={EditIcon}
                onClick={() => onEdit(node)}
                accessibilityLabel="Edit"
              />
            </Tooltip>
            <Tooltip content={`Add Media to "${node.title}"`}>
              <Button
                size="micro"
                icon={PlusIcon}
                onClick={() => onAddMedia(node)}
                accessibilityLabel="Add Media"
              />
            </Tooltip>
            <Tooltip
              content={`Add ${node.type === "category" ? "Sub Category" : "Folder"}`}
            >
              <Button
                size="micro"
                onClick={() =>
                  onAddChild(
                    node.id,
                    node.type,
                    node.type === "category" ? "sub_category" : "folder"
                  )
                }
              >
                +{" "}
                {node.type === "category" ? "Sub Category" : "Folder"}
              </Button>
            </Tooltip>
            <Tooltip content="Delete">
              <Button
                size="micro"
                tone="critical"
                icon={DeleteIcon}
                onClick={() => onDelete(node.id, node.type, node.title)}
                accessibilityLabel="Delete"
              />
            </Tooltip>
          </InlineStack>
        )}
      </div>

      {/* ── Expanded Content ── */}
      {isExpanded && (
        <Box>
          {/* Unified Content Grid (folders + media) */}
          {renderMediaGrid?.()}

          {/* Inline Add Form */}
          {addingState?.parentId === node.id && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "10px 12px",
                paddingLeft: `${48 + indent}px`,
                borderBottom: "1px solid var(--p-color-border-secondary)",
                background: "var(--p-color-bg-surface-secondary)",
              }}
            >
              <div style={{ flex: 1 }}>
                <TextField
                  label="New item"
                  labelHidden
                  value={newTitle}
                  onChange={setNewTitle}
                  autoComplete="off"
                  autoFocus
                  placeholder={`New ${addingState.childType.replace("_", " ")} title…`}
                />
              </div>
              <Button
                variant="primary"
                onClick={submitCreate}
                disabled={isSubmitting || !newTitle.trim()}
              >
                Add
              </Button>
              <Button onClick={cancelCreate}>Cancel</Button>
            </div>
          )}

          {/* 
            Children tree — only for category nodes.
            Sub_category children (folders) are rendered inside ContentGrid,
            so we skip rendering them as tree rows here.
          */}
          {node.type === "category" && node.children.length > 0 && (
            <SortableContext
              items={node.children.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {node.children.map((child) => renderChildNode(child, depth + 1))}
            </SortableContext>
          )}
        </Box>
      )}
    </Box>
  );
}