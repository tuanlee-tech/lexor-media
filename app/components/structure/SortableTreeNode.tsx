import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { StructureNode, AddingState } from "./types";
import { TreeNodePolaris } from "./TreeNodePolaris";

interface Props {
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
  isActiveEdit: boolean;
  renderMediaGrid?: () => React.ReactNode;
}

export function SortableTreeNode(props: Props) {
  const { node } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TreeNodePolaris
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
