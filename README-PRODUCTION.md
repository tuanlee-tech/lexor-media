# Lexor Media Gallery — Production Setup & Migration Guide

This guide covers the production architecture, setup from scratch, and deployment for the **Lexor Media Gallery** Shopify App. 

In this production release, we have **abandoned Cloudflare Pages** for the Admin UI and migrated to an embedded **Shopify Admin App (Remix/Vite hosted on Render)**, while keeping the high-performance **Cloudflare Workers + D1 Database** as our media API backend.

---

## Table of Contents
1. [Production Architecture](#1-production-architecture)
2. [Cloudflare Backend Setup (Worker & D1)](#2-cloudflare-backend-setup-worker--d1)
3. [Shopify App (Admin UI) Setup From Scratch](#3-shopify-app-admin-ui-setup-from-scratch)
4. [Storefront Widget Integration (Theme App Extension)](#4-storefront-widget-integration-theme-app-extension)
5. [Production Deployment on Render (Shopify App)](#5-production-deployment-on-render-shopify-app)
   * [Build and Start Commands](#build-and-start-commands)
   * [Production Environment Variables on Render](#production-environment-variables-on-render)
   * [Keeping the Free Tier Awake (Cron-job Setup)](#keeping-the-free-tier-awake-cron-job-setup)

---

## Simple Setup Flow

```text
1. Cloudflare Backend Setup (Create DB & Deploy Worker)
   │
   ▼
2. Setup Shopify App (Configure Settings & Develop UI)
   │
   ▼
3. Storefront Widget (Generate App Embed Block)
   │
   ▼
4. Deploy to Render (Build & Run Remix App)
   │
   ▼
5. Keep Awake via Cron (Cron-job.org every 14 mins)
   │
   ▼
🎉 Production Ready
```



## 1. Production Architecture

```text
       +-----------------------------------------------------+
       |                  SHOPIFY ADMIN                      |
       |  (Embedded Polaris Admin App - Hosted on Render)    |
       +--------------------------+--------------------------+
                                  |
                                  | RPC/REST API
                                  v
       +-----------------------------------------------------+
       |               CLOUDFLARE WORKERS API                |
       |  (Handles JWT auth, DB logic, routes, media fetch)  |
       +--------------------------+--------------------------+
                                  |
                                  | D1 Bindings
                                  v
       +-----------------------------------------------------+
       |               CLOUDFLARE D1 DATABASE                |
       |         (Stores categories, folders, media)         |
       +-----------------------------------------------------+
                                  ^
                                  | Storefront Media Request
                                  |
       +--------------------------+--------------------------+
       |               SHOPIFY STOREFRONT WIDGET             |
       |    (Theme App Extension: Assets, CSS/JS embed)      |
       +-----------------------------------------------------+
```

### Production API Details
*   **Worker API URL**: `https://lexor-media-gallery-api.lexortechdev.workers.dev`
*   **Database Name**: `lexor-media-gallery-db`

---

## 2. Cloudflare Backend Setup (Worker & D1)

### Login to Cloudflare
Check current session:
```bash
npx wrangler whoami
```
Authenticate:
```bash
npx wrangler login
```

### D1 Database Provisioning
Create database instance:
```bash
npx wrangler d1 create lexor-media-gallery-db
```
*Note down the Database ID outputted in the terminal.*

### Database Schema & Seed Setup
Apply schema to create tables (`categories`, `sub_categories`, `folders`, `media_items`):
*   **Local development DB:**
    ```bash
    npx wrangler d1 execute lexor-media-gallery-db --file=./d1/schema.sql --local
    ```
*   **Production remote DB:**
    ```bash
    npx wrangler d1 execute lexor-media-gallery-db --file=./d1/schema.sql --remote
    ```

Insert seed data (default categories and structure):
*   **Local development DB:**
    ```bash
    npx wrangler d1 execute lexor-media-gallery-db --file=./d1/seed.sql --local
    ```
*   **Production remote DB:**
    ```bash
    npx wrangler d1 execute lexor-media-gallery-db --file=./d1/seed.sql --remote
    ```

### Check Database Content
Query tables list:
```bash
npx wrangler d1 execute lexor-media-gallery-db --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```
Verify categories data:
```bash
npx wrangler d1 execute lexor-media-gallery-db --command="SELECT * FROM categories;" --remote
```

### Deploying the Cloudflare Worker API
1. Configure `worker/wrangler.toml` (Paste your Database ID):
    ```toml
    name = "lexor-media-gallery-api"
    main = "src/index.ts"
    compatibility_date = "2025-06-01"

    [vars]
    CORS_ORIGIN = "*"

    # Set these as secrets, not plain text:
    # npx wrangler secret put ADMIN_SESSION_SECRET

    [[d1_databases]]
    binding = "DB"
    database_name = "lexor-media-gallery-db"
    database_id = "YOUR_DATABASE_ID_HERE"
    ```
2. Build & Deploy:
    ```bash
    cd worker
    npm install
    npx wrangler deploy
    ```

---

## 3. Shopify App (Admin UI) Setup From Scratch

The new admin uses a Shopify Embedded App framework utilizing React Polaris, Vite, and Remix.

### Initialize Project
Run Shopify CLI to create a new app:
```bash
npm init @shopify/app@latest
```
*   **App Name**: `lexor-media`
*   **Template**: `Start with Remix (recommended)`
*   **Language**: `TypeScript`

### Configure Cloudflare Credentials in App Settings
The credentials for connecting to the Cloudflare Worker API are configured directly in the **Settings** tab of the app inside Shopify Admin (saved to the database via Prisma). 

For local fallback defaults during development, you can define them in your `.env` file (these are optional):
```env
CF_WORKER_API_URL="https://lexor-media-gallery-api.lexortechdev.workers.dev"
CF_WORKER_API_TOKEN="[ADMIN_SESSION_SECRET]"
```

### Run Shopify App Locally
Run the development command which initiates a tunnel (Cloudflare Tunnel) and maps the app configurations:
```bash
npm run dev
```
Select "Yes, create it as a new app" when prompted, and configure the store scope.

---

## 4. Storefront Widget Integration (Theme App Extension)

Instead of using raw liquid sections manually copied to the theme, we leverage Shopify's **Theme App Extension** to safely inject assets without altering store theme code.

### Generate Extension
Inside the project root directory, run:
```bash
npm run shopify app generate extension
```
*   **Type**: `Theme app extension`
*   **Name**: `lexor-media-widget`

### Directory Layout
Move widget files inside the extension directories:
```text
extensions/lexor-media-widget/
├── assets/
│   ├── lexor-media-gallery.css
│   └── lexor-media-gallery.js
├── blocks/
│   └── gallery.liquid
└── shopify.extension.toml
```

### Configure the App Embed Block
Edit `extensions/lexor-media-widget/blocks/gallery.liquid`:
```liquid
{%- liquid
  assign section_id = 'LexorMediaGallery-' | append: block.id
  assign api_domain = shop.metafields.lexor_media.api_url
-%}

{%- if api_domain == blank -%}
  <div class="page-width" style="padding: 40px 0; text-align: center; color: #d82c0d; font-family: sans-serif;">
    <p>⚠️ <strong>Lexor Media App is not fully configured.</strong><br>Please open the Lexor Media app in your Shopify Admin and save the Cloudflare Worker URL settings.</p>
  </div>
{%- else -%}
  {{ 'lexor-media-gallery.css' | asset_url | stylesheet_tag }}
  <script src="{{ 'lexor-media-gallery.js' | asset_url }}" defer></script>

  <section id="{{ section_id }}" class="lexor-media-gallery-section" {{ block.shopify_attributes }}>
    <div class="lexor-media-gallery-section__inner">
      <lexor-media-gallery
        api-base="{{ api_domain }}"
        limit="{{ block.settings.items_per_page }}"
        {%- if block.settings.default_category != blank -%}
          default-category="{{ block.settings.default_category | handleize }}"
        {%- endif -%}
      ></lexor-media-gallery>
    </div>
  </section>
{%- endif -%}

{% schema %}
{
  "name": "Media Gallery",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "default_category",
      "label": "Default category handle"
    },
    {
      "type": "range",
      "id": "items_per_page",
      "label": "Items per page",
      "min": 12,
      "max": 60,
      "step": 12,
      "default": 36
    }
  ]
}
{% endschema %}
```

---

## 5. Production Deployment on Render (Shopify App)

Because Render Free Tier goes to sleep (Spins Down) after 15 minutes of inactivity, we configure the app to handle cold starts and keep it awake.

### Build and Start Commands
Configure Render Web Service settings:
*   **Environment**: `Node`
*   **Build Command**: `npm install && npm run build`
*   **Start Command**: `npm run start`

### Production Environment Variables on Render
Add these key-value pairs in the Render Environment tab:
```env
PORT=10000
SHOPIFY_API_KEY="your-shopify-api-key"
SHOPIFY_API_SECRET="your-shopify-api-secret"
SCOPES="write_products,write_themes,read_themes"
SHOPIFY_APP_URL="https://lexor-media.onrender.com"
CF_WORKER_API_URL="https://lexor-media-gallery-api.lexortechdev.workers.dev"
CF_WORKER_API_TOKEN="lexor-admin-2026"
```

### Keeping the Free Tier Awake (Cron-job Setup)

To avoid 15-minute inactivity timeouts on Render, configure a ping scheduler on [cron-job.org](https://cron-job.org) to ping your app's base URL:

1. Create a free account and click **Create Cronjob**.
2. **Title**: `Lexor Media Heartbeat`
3. **URL**: `https://your-render-app-url.onrender.com/` (Replace with your actual Render App URL)
4. **Execution Schedule**:
    *   Select **Custom**.
    *   Set **Crontab expression**: `*/14 * * * *` (Pings every 14 minutes).
5. Click **Create**.

Any request (even if redirected) will keep the Render container active and prevent the app from sleeping. Your Render-hosted Remix app will now stay persistently awake!

---

## 6. Deploying to the Production/Live Shopify Store

When migrating from your **Local/Dev Store** setup to your **Live/Production Shopify Store**, follow this checklist:

### Step 1: Update URLs in Shopify App Configuration
Shopify CLI 3.x manages your app settings via the local `shopify.app.toml` file. If you run `npm run deploy`, the local configuration will be uploaded and might overwrite dashboard changes. You have two options to update your URLs:

#### Option A: Edit `shopify.app.toml` directly (Recommended)
Open your local `shopify.app.toml` and replace the placeholder URLs with your Render Production URLs:
```toml
application_url = "https://lexor-media.onrender.com"

[auth]
redirect_urls = [
  "https://lexor-media.onrender.com/auth/callback",
  "https://lexor-media.onrender.com/auth/shopify/callback",
  "https://lexor-media.onrender.com/api/auth/callback"
]
```
When you run `npm run deploy` in the next step, these URLs will be automatically pushed to the Shopify Partners Dashboard.

#### Option B: If you already updated URLs in the Partners Dashboard
If you edited the settings in the Partners browser dashboard first, you **MUST** pull those settings down to your local codebase before deploying, otherwise the deploy command will overwrite them with the old local config:
```bash
npx shopify app config pull
```
*(Select the active app configuration to merge changes into your local `shopify.app.toml`).*

### Step 2: Deploy and Release the Theme Extension
You need to build and publish the theme app extension code to Shopify so the live store theme can fetch it:
1. Build & upload the extension:
   ```bash
   npm run deploy
   ```
   *(This creates a draft version of the extension in your Partners Dashboard).*
2. Go to Partners Dashboard -> **Extensions** -> Select **lexor-media-widget**.
3. Click **Create version** and select the latest build, then click **Publish**.

### Step 3: Install the App on your Live Store
1. In the Partners Dashboard under the **Overview** or **Test your app** page, click the install link or select your **Production Store** to trigger installation.
2. Accept the installation scopes and permissions.
3. Open the app inside the Live Store Admin, go to **Settings** and set your production **Cloudflare Worker API URL** and **API Token**.

### Step 4: Add Widget to Live Store Theme
1. Open the Live Store Theme Customizer.
2. Navigate to the page you want to show the gallery (e.g. `/pages/media` or home page).
3. Under **Add Section** or **Add Block**, find **Lexor Media Gallery** (App Embed / Section block).
4. Save the theme.

