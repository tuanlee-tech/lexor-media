/**
 * Structure Page — Local Types
 */

export interface StructureNode {
  id: string;
  type: "category" | "sub_category" | "folder";
  title: string;
  handle: string;
  parent_id: string | null;
  grandparent_id?: string | null;
  sort_order: number;
  is_active: boolean;
  description?: string | null;
  cover_image_url?: string | null;
  children: StructureNode[];
  icon_svg?: string | null;
  media_count?: number;
}

export interface MediaItemLocal {
  id: string;
  category_id: string;
  sub_category_id: string;
  folder_id?: string | null;
  media_type: "image" | "video";
  source_type: "shopify" | "youtube" | "external";
  shopify_file_id?: string | null;
  url: string;
  thumbnail_url?: string | null;
  title: string;
  alt?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface EditDrawerData {
  id: string;
  type: "category" | "sub_category" | "folder" | "media";
  title: string;
  handle?: string;
  icon_svg?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_active: boolean;
  // Media-specific
  url?: string;
  thumbnail_url?: string | null;
  alt?: string | null;
  media_type?: "image" | "video";
  source_type?: "shopify" | "youtube" | "external";
}

export type AddChildType = "sub_category" | "folder" | "media_shopify" | "media_external" | "media_youtube";

export interface AddingState {
  parentId: string;
  parentType: "category" | "sub_category" | "folder";
  grandparentId?: string | null;
  childType: "category" | "sub_category" | "folder";
}
