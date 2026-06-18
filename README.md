# Lexor Media App

Lexor Media App is a custom Shopify application designed to manage a deeply nested media gallery (`Category` -> `Sub-Category` -> `Folder` -> `Media`) directly from the Shopify Admin interface. It provides an intuitive, Polaris-based structure builder that seamlessly syncs with a serverless Cloudflare Worker / D1 backend.

## ✨ Core Features

- **Nested Structure Builder**: Easily build and manage complex media hierarchies.
- **Drag & Drop Reordering**: Seamlessly reorder categories, sub-categories, and folders using a smooth `dnd-kit` integration.
- **Shopify Files Integration**: Browse, upload, and select media/thumbnails directly from the native Shopify Content Files storage without leaving the app.
- **Optimistic UI Updates**: Experience instantaneous feedback when editing or moving items without waiting for network requests to complete.
- **Multi-Source Media**: Support for Shopify Files, YouTube videos, and External URLs.
- **Headless Backend Integration**: Communicates securely with the existing Lexor Media Cloudflare Worker & D1 database architecture.

## 🛠 Tech Stack

- **Frontend**: React, Remix (React Router v7), Shopify Polaris, Shopify App Bridge v4
- **Backend**: Node.js (App Server), Cloudflare Worker / D1 SQLite (Data API)
- **Deployment**: Docker, Render.com (or Fly.io)
- **Utilities**: `dnd-kit` for drag-and-drop, Shopify GraphQL Admin API

## 🚀 Quick Start (Local Development)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/tuanlee-tech/lexor-media.git
cd lexor-media
npm install
```

### 2. Run Development Server

Start the local development server using the Shopify CLI:

```bash
npm run dev
```

Shopify CLI will automatically provision a Cloudflare tunnel and prompt you to install the app on your Shopify Development Store.

## 🌍 Deployment (Render.com)

This application is fully prepared for zero-configuration deployment to Render.com using the included multi-stage `Dockerfile`.

1. Push your codebase to GitHub.
2. In the Render Dashboard, create a new **Web Service** and connect your GitHub repository.
3. Render will automatically detect the `Dockerfile` and build the application.
4. **Environment Variables**: You must add the following variables in the Render dashboard before the app can run:
   - `SHOPIFY_API_KEY`: Your Shopify App Client ID (from Partner Dashboard).
   - `SHOPIFY_API_SECRET`: Your Shopify App Client Secret (from Partner Dashboard).
   - `SCOPES`: `write_products,write_metaobjects,write_metaobject_definitions,read_files,write_files`
   - `SHOPIFY_APP_URL`: The production URL Render provides (e.g., `https://lexor-media.onrender.com`).
5. **Partner Dashboard**: Update the *App URL* and *Allowed redirection URL(s)* in your Shopify Partner Dashboard to match your new Render URL.

*(Note: If using the free tier on Render without a persistent disk, SQLite session data will be reset on restarts, requiring you to re-authenticate the app in Shopify Admin. For stable production use, attach a Disk or deploy to a VPS).*

---

*Developed for the Lexor ecosystem.*
