import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getAppConfig } from "../lib/api.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const config = await getAppConfig(request);
  return {
    config,
    envOverride: {
      apiUrl: !!process.env.CF_WORKER_API_URL,
      apiToken: !!process.env.CF_WORKER_API_TOKEN,
    }
  };
};

export default function SettingsPage() {
  const { config, envOverride } = useLoaderData<typeof loader>();
  const hasConfig = !!config.apiUrl && !!config.apiToken;

  return (
    <s-page heading="Settings">
      <s-section heading="Cloudflare Worker Connection">
        <s-banner tone={hasConfig ? "success" : "critical"}>
          <p>
            {hasConfig
              ? `Connected to ${config.apiUrl.replace(/^https?:\/\//, '').split('/')[0]}`
              : "Not configured. Add CF_WORKER_API_URL and CF_WORKER_API_TOKEN to your Render environment variables."}
          </p>
        </s-banner>

        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--p-color-text-secondary)" }}>
              API URL
            </label>
            <div style={{ padding: "8px 12px", background: "var(--p-color-bg-surface-secondary)", borderRadius: "6px", fontSize: "14px", fontFamily: "monospace" }}>
              {config.apiUrl || <span style={{ color: "var(--p-color-text-secondary)", fontStyle: "italic" }}>Not set</span>}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--p-color-text-secondary)" }}>
              API Token
            </label>
            <div style={{ padding: "8px 12px", background: "var(--p-color-bg-surface-secondary)", borderRadius: "6px", fontSize: "14px", fontFamily: "monospace" }}>
              {config.apiToken ? "••••••••" + config.apiToken.slice(-4) : <span style={{ color: "var(--p-color-text-secondary)", fontStyle: "italic" }}>Not set</span>}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--p-color-text-secondary)" }}>
              Source
            </label>
            <div style={{ padding: "8px 12px", background: "var(--p-color-bg-surface-secondary)", borderRadius: "6px", fontSize: "14px" }}>
              {envOverride.apiUrl || envOverride.apiToken ? (
                <span style={{ color: "var(--p-color-text-success)" }}>● Environment variables (Render)</span>
              ) : config.source === "database" ? (
                <span>Database (per-shop)</span>
              ) : (
                <span style={{ color: "var(--p-color-text-critical)" }}>Not configured</span>
              )}
            </div>
          </div>
        </div>
      </s-section>

      <s-section slot="aside" heading="How to Configure">
        <s-paragraph>
          Set these environment variables in your Render dashboard:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item><code>CF_WORKER_API_URL</code></s-list-item>
          <s-list-item><code>CF_WORKER_API_TOKEN</code></s-list-item>
        </s-unordered-list>
        <s-paragraph>
          Redeploy after adding or changing values.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);