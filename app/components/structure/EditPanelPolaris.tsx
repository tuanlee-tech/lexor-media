import { useState, useEffect } from "react";
import { Card, BlockStack, InlineStack, Text, Button, TextField, Box, Divider, Checkbox, Select } from "@shopify/polaris";
import type { EditDrawerData } from "./types";
import { AddMediaModalPolaris, type AddMediaResult } from "./AddMediaModalPolaris";

interface Props {
  data: EditDrawerData;
  onClose: () => void;
  onSave: (data: EditDrawerData) => void;
  onChange?: (data: EditDrawerData) => void;
  isSubmitting: boolean;
}

export function EditPanelPolaris({ data, onClose, onSave, onChange, isSubmitting }: Props) {
  const [form, setForm] = useState<EditDrawerData>({ ...data });
  const [pickerTarget, setPickerTarget] = useState<"source" | "thumbnail" | "cover" | null>(null);

  useEffect(() => {
    setForm({ ...data });
  }, [data]);

  const update = (field: keyof EditDrawerData, value: any) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      onChange?.(next);
      return next;
    });
  };

  const typeLabel = form.type === "category" ? "Category" :
    form.type === "sub_category" ? "Sub Category" :
      form.type === "folder" ? "Folder" : "Media";

  const handleReplace = (items: AddMediaResult[]) => {
    if (items.length > 0) {
      const item = items[0];
      setForm(prev => {
        if (pickerTarget === "thumbnail") {
          const next = { ...prev, thumbnail_url: item.thumbnail_url || item.url };
          onChange?.(next);
          return next;
        }
        if (pickerTarget === "cover") {
          const next = { ...prev, cover_image_url: item.thumbnail_url || item.url };
          onChange?.(next);
          return next;
        }
        const next = {
          ...prev,
          source_type: item.type,
          media_type: item.media_type,
          url: item.url,
          thumbnail_url: item.thumbnail_url || prev.thumbnail_url,
          title: prev.title || item.title || "",
          alt: prev.alt || item.alt || ""
        };
        onChange?.(next);
        return next;
      });
    }
    setPickerTarget(null);
  };

  return (
    <>
      <Card roundedAbove="sm">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Edit {typeLabel}</Text>
              <Text as="p" variant="bodySm" tone="subdued">ID: {form.id.slice(0, 8)}…</Text>
            </BlockStack>
            <Button onClick={onClose} variant="tertiary" size="micro">✕</Button>
          </InlineStack>

          <Divider />

          <BlockStack gap="400">
            <TextField
              label="Title"
              value={form.title}
              onChange={(v) => update("title", v)}
              autoComplete="off"
            />

            {form.handle !== undefined && (
              <TextField
                label="Handle (URL slug)"
                value={form.handle || ""}
                onChange={() => { }}
                autoComplete="off"
                disabled
                helpText="Auto-generated from title."
              />
            )}

            {/* icon_svg cho category */}
            {form.type === "category" && (
              <BlockStack gap="200">
                <TextField
                  label="Icon SVG"
                  value={form.icon_svg || ""}
                  onChange={(v) => update("icon_svg", v)}
                  autoComplete="off"
                  multiline={4}
                  helpText="Paste SVG markup here. Used in the gallery sidebar."
                />
                {form.icon_svg && (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <InlineStack gap="200" align="start" blockAlign="center">
                      <div dangerouslySetInnerHTML={{ __html: form.icon_svg }} style={{ width: 24, height: 24 }} />
                      <Text as="span" variant="bodySm" tone="subdued">Preview</Text>
                    </InlineStack>
                  </Box>
                )}
              </BlockStack>
            )}

            {(form.type === "folder" || form.type === "media") && (
              <TextField
                label="Description"
                value={form.description || ""}
                onChange={(v) => update("description", v)}
                autoComplete="off"
                multiline={3}
              />
            )}

            {form.type === "media" && (
              <TextField
                label="Alt Text"
                value={form.alt || ""}
                onChange={(v) => update("alt", v)}
                autoComplete="off"
                helpText="Describe this media for screen readers."
              />
            )}

            {form.type === "media" && form.source_type !== "shopify" && (
              <TextField
                label="Media URL"
                value={form.url || ""}
                onChange={(v) => update("url", v)}
                autoComplete="off"
              />
            )}

            {form.type === "media" && (
              <BlockStack gap="200">
                <TextField
                  label="Thumbnail URL"
                  value={form.thumbnail_url || ""}
                  onChange={(v) => update("thumbnail_url", v)}
                  autoComplete="off"
                  connectedRight={<Button onClick={() => setPickerTarget("thumbnail")}>Browse</Button>}
                />
                {form.thumbnail_url && (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <img src={form.thumbnail_url} alt="thumbnail" style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain" }} />
                  </Box>
                )}
              </BlockStack>
            )}

            {form.type === "folder" && (
              <BlockStack gap="200">
                <TextField
                  label="Cover Image URL"
                  value={form.cover_image_url || ""}
                  onChange={(v) => update("cover_image_url", v)}
                  autoComplete="off"
                  connectedRight={<Button onClick={() => setPickerTarget("cover")}>Browse</Button>}
                />
                {form.cover_image_url && (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <img src={form.cover_image_url} alt="cover" style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain" }} />
                  </Box>
                )}
              </BlockStack>
            )}

            {form.type === "media" && form.source_type && (
              <BlockStack gap="200">
                <Select
                  label="Source Type"
                  options={[
                    { label: "📦 Shopify Files", value: "shopify" },
                    { label: "▶ YouTube", value: "youtube" },
                    { label: "🌐 External URL", value: "external" }
                  ]}
                  value={form.source_type}
                  onChange={(v) => update("source_type", v)}
                  disabled
                />
                <Button onClick={() => setPickerTarget("source")}>Change Media Source</Button>
              </BlockStack>
            )}

            <Checkbox
              label="Active (Visible to users)"
              checked={(form.is_active as any) === true || (form.is_active as any) === 1 || (form.is_active as any) === "1"}
              onChange={(checked) => update("is_active", checked)}
            />
          </BlockStack>

          <Divider />

          <InlineStack align="end" gap="200">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => onSave(form)} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <AddMediaModalPolaris
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSubmit={handleReplace}
        isSubmitting={false}
      />
    </>
  );
}
