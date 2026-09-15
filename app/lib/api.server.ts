/**
 * Cloudflare Worker API client — server-side only.
 *
 * All calls to the existing CF Worker API (D1 backend) go through here.
 * The Shopify app routes import this on their server-side loaders/actions
 * so the CF Worker auth token never leaks to the browser.
 */

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import type {
  Category,
  SubCategory,
  Folder,
  MediaItem,
  TreeResponse,
  MediaResponse,
  AdminItemResponse,
  AdminListResponse,
  CategoryPayload,
  SubCategoryPayload,
  FolderPayload,
  MediaItemPayload,
} from "../types/media";

export async function getAppConfig(request: Request) {
  const { session } = await authenticate.admin(request);

  // 1. Priority: Render environment variables (persistent across deploys)
  const envApiUrl = process.env.CF_WORKER_API_URL || "";
  const envApiToken = process.env.CF_WORKER_API_TOKEN || "";

  // 2. Fallback: Database (per-shop, manual via UI)
  const dbSettings = await prisma.appSettings.findUnique({
    where: { shop: session.shop },
  });

  return {
    apiUrl: envApiUrl || dbSettings?.apiUrl || "",
    apiToken: envApiToken || dbSettings?.apiToken || "",
    source: envApiUrl ? "env" : dbSettings?.apiUrl ? "database" : "none",
  };
}

async function hmacSha256(secret: string, value: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

function base64UrlEncode(bufferOrString: ArrayBuffer | string): string {
  let uint8Array: Uint8Array;
  if (typeof bufferOrString === "string") {
    uint8Array = new TextEncoder().encode(bufferOrString);
  } else {
    uint8Array = new Uint8Array(bufferOrString);
  }
  let str = "";
  for (let i = 0; i < uint8Array.length; i++) {
    str += String.fromCharCode(uint8Array[i]);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createWorkerToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour valid
  const payload = base64UrlEncode(
    JSON.stringify({ sub: "shopify-admin", exp: expiresAt, iat: Math.floor(Date.now() / 1000) }),
  );
  const signatureBuffer = await hmacSha256(secret, payload);
  const signature = base64UrlEncode(signatureBuffer);
  return `${payload}.${signature}`;
}

export async function getApiClient(request: Request) {
  const config = await getAppConfig(request);
  const base = config.apiUrl.replace(/\/+$/, "");

  async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!base) throw new Error("Cloudflare Worker API URL is not configured. Please set it in Settings.");
    const url = `${base}${path}`;
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (config.apiToken) {
      // For legacy compatibility, pass as X-Admin-Secret
      headers.set("X-Admin-Secret", config.apiToken);
      // For new JWT-based auth, sign a token using ADMIN_SESSION_SECRET
      const token = await createWorkerToken(config.apiToken);
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `CF Worker API error: ${response.status} ${response.statusText} — ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  return {
    fetchTree: () => apiFetch<TreeResponse>("/api/gallery/tree"),

    fetchMedia: (params: {
      category?: string;
      sub?: string;
      folder?: string;
      type?: string;
      page?: number;
      limit?: number;
      search?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params.category) qs.set("cat", params.category);
      if (params.sub) qs.set("sub", params.sub);
      if (params.folder) qs.set("folder", params.folder);
      if (params.type) qs.set("type", params.type);
      if (params.page) qs.set("page", String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.search) qs.set("search", params.search);

      return apiFetch<MediaResponse>(`/api/gallery/media?${qs.toString()}`);
    },

    getCategories: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return apiFetch<AdminListResponse<Category>>(`/api/admin/categories${qs}`);
    },

    createCategory: (data: CategoryPayload) =>
      apiFetch<AdminItemResponse<Category>>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateCategory: (id: string, data: Partial<CategoryPayload>) =>
      apiFetch<AdminItemResponse<Category>>(`/api/admin/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteCategory: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/categories/${id}`, { method: "DELETE" }),

    getSubCategories: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return apiFetch<AdminListResponse<SubCategory>>(`/api/admin/sub-categories${qs}`);
    },

    createSubCategory: (data: SubCategoryPayload) =>
      apiFetch<AdminItemResponse<SubCategory>>("/api/admin/sub-categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateSubCategory: (id: string, data: Partial<SubCategoryPayload>) =>
      apiFetch<AdminItemResponse<SubCategory>>(`/api/admin/sub-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteSubCategory: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/sub-categories/${id}`, { method: "DELETE" }),

    getFolders: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return apiFetch<AdminListResponse<Folder>>(`/api/admin/folders${qs}`);
    },

    createFolder: (data: FolderPayload) =>
      apiFetch<AdminItemResponse<Folder>>("/api/admin/folders", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateFolder: (id: string, data: Partial<FolderPayload>) =>
      apiFetch<AdminItemResponse<Folder>>(`/api/admin/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteFolder: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/folders/${id}`, { method: "DELETE" }),

    getMediaItems: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return apiFetch<AdminListResponse<MediaItem>>(`/api/admin/media${qs}`);
    },

    createMediaItem: (data: MediaItemPayload) =>
      apiFetch<AdminItemResponse<MediaItem>>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateMediaItem: (id: string, data: Partial<MediaItemPayload>) =>
      apiFetch<AdminItemResponse<MediaItem>>(`/api/admin/media/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    deleteMediaItem: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/media/${id}`, { method: "DELETE" }),

    bulkUpdateSortOrder: async (
      resource: "categories" | "sub-categories" | "folders" | "media",
      items: Array<{ id: string; sort_order: number }>,
    ) => {
      await Promise.all(
        items.map((item) =>
          apiFetch(`/api/admin/${resource}/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sort_order: item.sort_order }),
          }),
        ),
      );
    },

    bulkUpdateManualOrder: async (
      items: Array<{ id: string; manual_order: number | null; sort_order?: number }>,
    ) => {
      await Promise.all(
        items.map((item) =>
          apiFetch(`/api/admin/media/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify(
              item.sort_order === undefined
                ? { manual_order: item.manual_order }
                : { manual_order: item.manual_order, sort_order: item.sort_order },
            ),
          }),
        ),
      );
    },
  };
}
