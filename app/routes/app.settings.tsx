import type { ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getAppConfig } from "../lib/api.server";
import prisma from "../db.server";
import { useEffect, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const config = await getAppConfig(request);
  return { config };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const apiUrl = (formData.get("apiUrl") as string) || "";
  const apiToken = (formData.get("apiToken") as string) || "";

  await prisma.appSettings.upsert({
    where: { shop: session.shop },
    update: { apiUrl, apiToken },
    create: { shop: session.shop, apiUrl, apiToken }
  });

  return { success: true };
};

export default function SettingsPage() {
  const { config } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const formRef = useRef<HTMLFormElement>(null);

  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Settings saved successfully");
    }
  }, [fetcher.data, shopify]);

  const hasConfig = !!config.apiUrl && !!config.apiToken;

  return (
    <s-page heading="Settings">
      <s-section heading="Cloudflare Worker Connection">
        <s-paragraph>
          Lexor Media connects to your Cloudflare Worker API for media data management.
          Enter your worker URL and admin token below.
        </s-paragraph>

        <fetcher.Form ref={formRef} method="post" style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>CF Worker API URL</label>
            <input
              type="url"
              name="apiUrl"
              defaultValue={config.apiUrl}
              placeholder="https://lexor-media-gallery-api.lexortechdev.workers.dev"
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid", fontSize: "14px" }}
              required
            />
            <div style={{ fontSize: "12px", color: "var(--p-color-text-secondary)", marginTop: "4px" }}>
              The base URL to your Cloudflare Worker (without trailing slash).
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>Admin API Token (ADMIN_SESSION_SECRET)</label>
            <input
              type="password"
              name="apiToken"
              defaultValue={config.apiToken}
              placeholder="Your Cloudflare ADMIN_SESSION_SECRET"
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid", fontSize: "14px" }}
              required
            />
            <div style={{ fontSize: "12px", color: "var(--p-color-text-secondary)", marginTop: "4px" }}>
              The ADMIN_SESSION_SECRET (or legacy ADMIN_SECRET) configured on your Cloudflare Worker.
            </div>
          </div>

          <div>
            <s-button
              variant="primary"
              onClick={() => {
                if (formRef.current) fetcher.submit(formRef.current);
              }}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Save Settings
            </s-button>
          </div>
        </fetcher.Form>

        {!hasConfig && (
          <div style={{ marginTop: "16px" }}>
            <s-banner tone="critical">
              <p>Your API connection is not configured. Please enter your Cloudflare Worker URL and token to use the app.</p>
            </s-banner>
          </div>
        )}
      </s-section>

      <s-section slot="aside" heading="Shopify App Scopes">
        <s-paragraph>
          This app requires the following scopes to function:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>write_products</s-list-item>
          <s-list-item>read_files / write_files</s-list-item>
          <s-list-item>write_metaobjects</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
