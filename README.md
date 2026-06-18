# Lexor Media App

Lexor Media App is a custom Shopify application designed to manage a deeply nested media gallery (`Category` -> `Sub-Category` -> `Folder` -> `Media`) directly from the Shopify Admin interface. It provides an intuitive, Polaris-based structure builder that seamlessly syncs with a serverless Cloudflare Worker / D1 backend, and displays seamlessly on the Shopify Storefront via a Theme App Extension.

---

## 🏗 Architecture Overview (For Developers)

This project is decoupled into **3 Main Components** to ensure scalability and speed:

### 1. Shopify Admin App (This Repository)
- **Tech Stack**: React, Remix (React Router v7), Shopify Polaris, Shopify App Bridge v4, Prisma (SQLite).
- **Role**: Provides the Admin Dashboard for store managers to drag-and-drop media, create folders, and select images directly from Shopify Files.
- **Where to edit**: 
  - UI Layouts: `app/routes/app._index.tsx`
  - Drag-and-Drop Logic: `app/components/structure/*`
  - App Settings & Metafields: `app/routes/app.settings.tsx`
  - API Client: `app/lib/api.server.ts`

### 2. Storefront Widget (Theme App Extension)
- **Tech Stack**: Shopify Liquid, Web Components, CSS.
- **Role**: Displays the Media Gallery to end customers on the live website. It fetches data directly from the Cloudflare API.
- **Where to edit**:
  - The Liquid block & schema: `extensions/lexor-media-widget/blocks/gallery.liquid`
  - The JS Web Component logic: `extensions/lexor-media-widget/assets/lexor-media-gallery.js` (Compiled from a separate frontend repo)
  - The styling: `extensions/lexor-media-widget/assets/lexor-media-gallery.css`
- **Note**: The API Base URL is automatically injected into the Liquid file via Shopify Metafields (`shop.metafields.lexor_media.api_url`), which is configured from the Admin App's Settings page.

### 3. Data Backend (External API)
- **Tech Stack**: Cloudflare Worker, Cloudflare D1 (SQLite).
- **Role**: The single source of truth for the folder structure and media items. The Admin App pushes data here, and the Storefront Widget pulls data from here.
- **Where to edit**: This lives in a separate repository (`lexor-media-gallery-api`).

---

## ✨ Core Features

- **Nested Structure Builder**: Easily build and manage complex media hierarchies.
- **Drag & Drop Reordering**: Seamlessly reorder categories, sub-categories, and folders using a smooth `dnd-kit` integration.
- **Shopify Files Integration**: Browse, upload, and select media/thumbnails directly from the native Shopify Content Files storage without leaving the app.
- **Optimistic UI Updates**: Experience instantaneous feedback when editing or moving items without waiting for network requests to complete.
- **1-Click Theme Integration**: Embedded Theme App Extension allows merchants to add the gallery to their store without touching Liquid code.

---

## 🚀 Developer Setup

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/tuanlee-tech/lexor-media.git
cd lexor-media
npm install
```

### 2. Run Local Development Server

Start the local development server using the Shopify CLI:

```bash
npm run dev
```

Shopify CLI will automatically provision a Cloudflare tunnel and prompt you to install the app on your Shopify Development Store. It will also hot-reload any changes made to the React code OR the Theme App Extension (`extensions/`).

### 3. Modifying the Storefront Widget
If you need to update the Javascript or CSS of the Storefront widget:
1. Make changes to the source code of your Web Component.
2. Build the output (`lexor-media-gallery.js` and `lexor-media-gallery.css`).
3. Replace the files located in `extensions/lexor-media-widget/assets/`.
4. Run `npm run deploy` to push the updated widget to all live Shopify stores.

---

## 🌍 Production Deployment (Render.com)

This application's Admin interface is deployed to Render.com using the included `Dockerfile`.

1. Push your codebase to GitHub.
2. In the Render Dashboard, create a new **Web Service** and connect your GitHub repository.
3. Render will automatically detect the `Dockerfile` and build the application.
4. **Environment Variables**: Add the following variables in the Render dashboard:
   - `SHOPIFY_API_KEY`: Your Shopify App Client ID.
   - `SHOPIFY_API_SECRET`: Your Shopify App Client Secret.
   - `SCOPES`: `read_files,write_files,write_products`
   - `SHOPIFY_APP_URL`: The production URL Render provides (e.g., `https://lexor-media.onrender.com`).
5. **Partner Dashboard**: Update the *App URL* and *Allowed redirection URL(s)* in your Shopify Partner Dashboard to match your new Render URL.
6. **Apply Metafield Config**: After deploying, open the Lexor Media app in your Shopify Admin, go to **Settings**, enter the Cloudflare API URL, and click "Save Settings". This is strictly required to sync the URL to the Storefront Widget!

*(Note: If using the free tier on Render without a persistent disk, the SQLite database `/app/prisma/dev.sqlite` will be reset on restarts, requiring you to re-authenticate the app in Shopify Admin and re-save the Settings. For stable production use, attach a Render Persistent Disk to `/app/prisma` or provide the API credentials directly via Render Environment Variables).*

---

*Developed for the Lexor ecosystem.*
