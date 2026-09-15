import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { dateInTimeZone, isValidMediaDate } from "../../lib/media-date";
import { Modal, Tabs, TextField, Button, BlockStack, InlineStack, Thumbnail, Text, Spinner, EmptySearchResult, Grid, Card } from "@shopify/polaris";

export interface AddMediaResult {
  media_date?: string | null;
  type: "shopify" | "external" | "youtube";
  url: string;
  thumbnail_url?: string;
  title: string;
  alt?: string;
  media_type: "image" | "video";
}

interface Props {
  today: string;
  timeZone: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (items: AddMediaResult[]) => void;
  isSubmitting: boolean;
}

export function AddMediaModalPolaris({ open, onClose, onSubmit, isSubmitting, today, timeZone }: Props) {
  const [selectedTab, setSelectedTab] = useState(0);
  const handleTabChange = useCallback((selectedTabIndex: number) => setSelectedTab(selectedTabIndex), []);

  const tabs = [
    { id: "shopify", content: "📦 Shopify Files" },
    { id: "external", content: "🌐 External URL" },
    { id: "youtube", content: "▶ YouTube" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Media"
      size="large"
    >
      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
      <Modal.Section>
        {selectedTab === 0 && <ShopifyFilesPicker onSubmit={onSubmit} onClose={onClose} isSubmitting={isSubmitting} today={today} timeZone={timeZone} />}
        {selectedTab === 1 && <ExternalUrlForm onSubmit={onSubmit} isSubmitting={isSubmitting} today={today} />}
        {selectedTab === 2 && <YouTubeForm onSubmit={onSubmit} isSubmitting={isSubmitting} today={today} />}
      </Modal.Section>
    </Modal>
  );
}

function ShopifyFilesPicker({ onSubmit, onClose, isSubmitting, today, timeZone }: Omit<Props, "open">) {
  const fetcher = useFetcher<any>();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [customDates, setCustomDates] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<any[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const isLoadMoreRef = useRef(false);

  // Load files
  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data && files.length === 0) {
      isLoadMoreRef.current = false;
      fetcher.load(`/api/shopify-files`);
    }
  }, [fetcher, files.length]);

  const handleRefresh = useCallback(() => {
    isLoadMoreRef.current = false;
    fetcher.load(`/api/shopify-files?search=${encodeURIComponent(search)}`);
  }, [search, fetcher]);

  // Auto-refresh when user switches back to this tab
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [handleRefresh]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    isLoadMoreRef.current = false;
    fetcher.load(`/api/shopify-files?search=${encodeURIComponent(value)}`);
  };

  const handleLoadMore = () => {
    if (!endCursor) return;
    isLoadMoreRef.current = true;
    fetcher.load(`/api/shopify-files?search=${encodeURIComponent(search)}&cursor=${encodeURIComponent(endCursor)}`);
  };

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const newFiles = fetcher.data.edges?.map((e: any) => e.node) || [];
      if (isLoadMoreRef.current) {
        setFiles(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          return [...prev, ...newFiles.filter((f: any) => !existingIds.has(f.id))];
        });
      } else {
        setFiles(newFiles);
      }
      setHasNextPage(fetcher.data.pageInfo?.hasNextPage || false);
      setEndCursor(fetcher.data.pageInfo?.endCursor || null);
    }
  }, [fetcher.data, fetcher.state]);

  const isLoading = fetcher.state === "loading" && !isLoadMoreRef.current;
  const isLoadingMore = fetcher.state === "loading" && isLoadMoreRef.current;

  const toggleSelect = (file: any) => {
    const next = new Set(selectedIds);
    if (next.has(file.id)) {
      next.delete(file.id);
      setCustomTitles(prev => { const n = { ...prev }; delete n[file.id]; return n; });
      setCustomDates(prev => { const n = { ...prev }; delete n[file.id]; return n; });
    } else {
      next.add(file.id);
      setCustomDates(prev => ({ ...prev, [file.id]: dateInTimeZone(file.createdAt, timeZone) }));
      // Pre-fill title from alt text or filename
      if (!customTitles[file.id]) {
        const defaultTitle = file.alt || file.filename || "";
        setCustomTitles(prev => ({ ...prev, [file.id]: defaultTitle }));
      }
    }
    setSelectedIds(next);
  };

  const handleAdd = () => {
    const selectedFiles = files.filter((f: any) => selectedIds.has(f.id));
    if (!selectedFiles.length || selectedFiles.some(f => !isValidMediaDate(customDates[f.id] || null, today))) return;
    const results: AddMediaResult[] = selectedFiles.map((f: any) => {
      const isVideo = !!f.sources;
      const isExternalVideo = !!f.embedUrl;
      const imgUrl = f.image?.url || f.preview?.image?.url || "";
      const vidUrl = isVideo ? f.sources[0]?.url : isExternalVideo ? f.embedUrl : "";
      const title = (customTitles[f.id] || "").trim() || f.alt || "Shopify Media";
      return {
        type: isExternalVideo ? "youtube" : "shopify",
        media_type: (isVideo || isExternalVideo) ? "video" : "image",
        url: (isVideo || isExternalVideo) ? vidUrl : imgUrl,
        thumbnail_url: imgUrl,
        title,
        media_date: customDates[f.id] || null,
        alt: f.alt || ""
      };
    });
    onSubmit(results);
  };

  const selectedFiles = files.filter(f => selectedIds.has(f.id));
  return (
    <BlockStack gap="400">
      <InlineStack blockAlign="center" gap="200">
        <div style={{ flex: 1 }}>
          <TextField
            label="Search files"
            labelHidden
            value={search}
            onChange={handleSearchChange}
            autoComplete="off"
            placeholder="Search Shopify Files..."
            clearButton
            onClearButtonClick={() => handleSearchChange("")}
          />
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>Refresh</Button>
      </InlineStack>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px" }}><Spinner /></div>
      ) : files.length === 0 ? (
        <EmptySearchResult title="No files found" description="Try changing your search term or upload files in Shopify Admin." withIllustration />
      ) : (
        <div style={{ maxHeight: selectedFiles.length > 0 ? "260px" : "400px", overflowY: "auto", padding: "4px", transition: "max-height 0.2s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px" }}>
            {files.map((file: any) => {
              const isSelected = selectedIds.has(file.id);
              const imgUrl = file.image?.url || file.preview?.image?.url || "";
              const isVideo = !!file.sources;
              const isExternalVideo = !!file.embedUrl;
              return (
                <div
                  key={file.id}
                  onClick={() => toggleSelect(file)}
                  style={{
                    border: isSelected ? "2px solid #1a1a1a" : "1px solid var(--p-color-border)",
                    borderRadius: "8px", overflow: "hidden", cursor: "pointer", position: "relative"
                  }}
                >
                  <div style={{ aspectRatio: "1/1", width: "100%", height: "100%", background: "#f6f6f7" }}>
                    {imgUrl ? <img src={imgUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  </div>
                  {isVideo && <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "10px", padding: "2px 4px", borderRadius: "4px" }}>VIDEO</div>}
                  {isExternalVideo && <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(255,0,0,0.8)", color: "white", fontSize: "10px", padding: "2px 4px", borderRadius: "4px" }}>{file.host === "YOUTUBE" ? "YouTube" : "External"}</div>}
                  {isSelected && <div style={{ position: "absolute", top: "4px", left: "4px", background: "#1a1a1a", color: "white", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
                </div>
              );
            })}
          </div>
          {hasNextPage && (
            <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "10px" }}>
              <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Selected files - editable titles */}
      {selectedFiles.length > 0 && (
        <div style={{ borderTop: "1px solid var(--p-color-border-secondary)", paddingTop: "12px" }}>
          <Text as="h3" variant="headingSm">Selected ({selectedFiles.length}) — Set titles before adding</Text>
          <div style={{ maxHeight: "160px", overflowY: "auto", marginTop: "8px" }}>
            <BlockStack gap="200">
              {selectedFiles.map((file: any) => {
                const imgUrl = file.image?.url || file.preview?.image?.url || "";
                return (
                  <InlineStack key={file.id} gap="300" blockAlign="center" wrap={false}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "6px", overflow: "hidden",
                      border: "1px solid var(--p-color-border)", flexShrink: 0, background: "#f6f6f7"
                    }}>
                      {imgUrl ? <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Title"
                        labelHidden
                        value={customTitles[file.id] || ""}
                        onChange={(val) => setCustomTitles(prev => ({ ...prev, [file.id]: val }))}
                        autoComplete="off"
                        placeholder="Enter title..."
                        size="slim"
                      />
                      <TextField
                        label="Media date (optional)"
                        type="date"
                        value={customDates[file.id] || ""}
                        onChange={(value) => setCustomDates(prev => ({ ...prev, [file.id]: value }))}
                        max={today}
                        autoComplete="off"
                        error={!isValidMediaDate(customDates[file.id] || null, today) ? "Enter a valid date on or before shop today." : undefined}
                      />
                    </div>
                    <Button
                      size="micro"
                      tone="critical"
                      onClick={() => toggleSelect(file)}
                      accessibilityLabel="Remove"
                    >✕</Button>
                  </InlineStack>
                );
              })}
            </BlockStack>
          </div>
        </div>
      )}

      <InlineStack align="space-between" blockAlign="center">
        <Button url="shopify:admin/content/files" target="_blank">Upload Files</Button>
        <InlineStack align="end" gap="200">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} disabled={selectedFiles.length === 0 || isSubmitting || selectedFiles.some(f => !isValidMediaDate(customDates[f.id] || null, today))}>
            Add {selectedIds.size > 0 ? `${selectedIds.size} file(s)` : ""}
          </Button>
        </InlineStack>
      </InlineStack>
    </BlockStack>
  );
}

function ExternalUrlForm({ onSubmit, isSubmitting, today }: Pick<Props, "onSubmit" | "isSubmitting" | "today">) {
  const [mediaDate, setMediaDate] = useState(today);
  const dateValid = isValidMediaDate(mediaDate || null, today);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState("");
  const [type, setType] = useState<"image" | "video">("image");

  return (
    <BlockStack gap="400">
      <TextField label="Media URL" value={url} onChange={setUrl} autoComplete="off" placeholder="https://..." />
      <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" />
      <TextField label="Thumbnail URL (Optional)" value={thumb} onChange={setThumb} autoComplete="off" />
      <TextField label="Media date (optional)" type="date" value={mediaDate} onChange={setMediaDate} max={today} autoComplete="off" error={!dateValid ? "Enter a valid date on or before shop today." : undefined} />

      <InlineStack gap="300">
        <Button pressed={type === "image"} onClick={() => setType("image")}>Image</Button>
        <Button pressed={type === "video"} onClick={() => setType("video")}>Video</Button>
      </InlineStack>

      <InlineStack align="end">
        <Button variant="primary" onClick={() => {
          if (!dateValid) return;
          onSubmit([{ type: "external", url, thumbnail_url: thumb, title: title || "External Media", media_type: type, media_date: mediaDate || null }]);
        }} disabled={!url || isSubmitting || !dateValid}>Add External Media</Button>
      </InlineStack>
    </BlockStack>
  );
}

function YouTubeForm({ onSubmit, isSubmitting, today }: Pick<Props, "onSubmit" | "isSubmitting" | "today">) {
  const [mediaDate, setMediaDate] = useState(today);
  const dateValid = isValidMediaDate(mediaDate || null, today);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const extractYoutubeId = (u: string) => {
    try {
      const urlObj = new URL(u);
      if (urlObj.hostname.includes("youtu.be")) return urlObj.pathname.split("/")[1];
      return urlObj.searchParams.get("v") || "";
    } catch { return ""; }
  };

  const ytId = extractYoutubeId(url);

  return (
    <BlockStack gap="400">
      <TextField label="YouTube URL" value={url} onChange={setUrl} autoComplete="off" placeholder="https://www.youtube.com/watch?v=..." />
      <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" />
      <TextField label="Media date (optional)" type="date" value={mediaDate} onChange={setMediaDate} max={today} autoComplete="off" error={!dateValid ? "Enter a valid date on or before shop today." : undefined} />

      {ytId && (
        <Card>
          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="yt preview" style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "8px" }} />
        </Card>
      )}

      <InlineStack align="end">
        <Button variant="primary" onClick={() => {
          if (!dateValid) return;
          onSubmit([{ type: "youtube", url, thumbnail_url: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "", title: title || "YouTube Video", media_type: "video", media_date: mediaDate || null }]);
        }} disabled={!url || isSubmitting || !dateValid}>Add YouTube Video</Button>
      </InlineStack>
    </BlockStack>
  );
}
