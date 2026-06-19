/**
 * Lexor Media Gallery — Shared Type Definitions
 * Maps to Cloudflare D1 schema from the existing worker API.
 */

// ── Entity Types ──────────────────────────────────────────────

export interface Category {
  id: string;
  title: string;
  handle: string;
  icon_svg?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sub_categories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  category_id: string;
  title: string;
  handle: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  category_id: string;
  sub_category_id: string;
  title: string;
  handle: string;
  description?: string | null;
  cover_image_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type MediaType = "image" | "video";
export type SourceType = "shopify" | "youtube" | "external";

export interface MediaItem {
  id: string;
  category_id: string;
  sub_category_id?: string | null;
  folder_id?: string | null;
  media_type: MediaType;
  source_type: SourceType;
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
  created_at: string;
  updated_at?: string;
}

// ── Tree Types ────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  type: "category" | "sub_category" | "folder";
  title: string;
  handle: string;
  parent_id?: string | null;
  sort_order: number;
  is_active: boolean;
  children: TreeNode[];
  /** Only for folders */
  cover_image_url?: string | null;
  /** Media count for this node */
  media_count?: number;
}

// ── API Response Types ────────────────────────────────────────

export interface TreeResponse {
  categories: Category[];
  sub_categories: SubCategory[];
  folders: Folder[];
}

export interface MediaResponse {
  scope: {
    category: { id: string; title: string; handle: string } | null;
    sub_category: { id: string; title: string; handle: string } | null;
    folder: { id: string; title: string; handle: string } | null;
    type: string;
  };
  page: number;
  limit: number;
  has_more: boolean;
  folders: Folder[];
  media: MediaItem[];
}

export interface AdminItemResponse<T> {
  item: T | null;
}

export interface AdminListResponse<T> {
  items: T[];
}

// ── Create/Update Payloads ────────────────────────────────────

export interface CategoryPayload {
  title: string;
  handle?: string;
  icon_svg?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface SubCategoryPayload {
  category_id: string;
  title: string;
  handle?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface FolderPayload {
  category_id: string;
  sub_category_id: string;
  title: string;
  handle?: string;
  description?: string | null;
  cover_image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface MediaItemPayload {
  category_id: string;
  sub_category_id?: string | null;
  folder_id?: string | null;
  media_type: MediaType;
  source_type: SourceType;
  shopify_file_id?: string | null;
  url: string;
  thumbnail_url?: string | null;
  title: string;
  alt?: string | null;
  description?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

// ── Shopify Files Types ───────────────────────────────────────

export interface ShopifyFile {
  id: string;
  alt?: string | null;
  createdAt: string;
  fileStatus: string;
  preview?: {
    image?: {
      url: string;
      width: number;
      height: number;
    } | null;
  } | null;
  /** For MediaImage */
  image?: {
    url: string;
    width: number;
    height: number;
  } | null;
  /** For Video */
  sources?: Array<{
    url: string;
    mimeType: string;
    format: string;
    width: number;
    height: number;
  }>;
  originalSource?: {
    url: string;
    fileSize?: string;
  } | null;
}
