import { createServerFn } from "@tanstack/react-start";
import { staticNotionPage } from "./static-notion-data";

/**
 * Maps local slug -> Notion page ID for projects.
 */
const PROJECT_PAGE_IDS: Record<string, string> = {
  "daljjanheun-haru": "ee9e574e-4279-83c8-abcf-01c7a4d0dccd",
  "photogray-shyungshyung": "32be574e-4279-80a8-a59e-d04cd8a587d8",
  "die-buehne": "d1be574e-4279-8272-8f2f-81d965f9ffc6",
  "adt": "332e574e-4279-80bf-ae19-ed03abf00e84",
};

const EXPERIENCE_PAGE_IDS: Record<string, string> = {
  "kosac-2025": "332e574e-4279-8096-af47-d112411d85b6",
};


const GATEWAY = "https://connector-gateway.lovable.dev/notion/v1";

type NotionFile = { url: string };
type NotionImageObj = { type: "file" | "external"; file?: NotionFile; external?: NotionFile };
type NotionRichText = { plain_text?: string };
type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  image?: NotionImageObj;
  file?: NotionImageObj;
  [key: string]: unknown;
};

function extractUrl(obj: NotionImageObj | undefined): string | null {
  if (!obj) return null;
  if (obj.type === "external") return obj.external?.url ?? null;
  if (obj.type === "file") return obj.file?.url ?? null;
  return null;
}

async function notionFetch(path: string, init?: RequestInit): Promise<unknown> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const notionKey = process.env.NOTION_API_KEY;
  if (!lovableKey || !notionKey) {
    throw new Error("Notion gateway credentials are not configured");
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": notionKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function collectImagesFromBlocks(pageId: string, depth = 0): Promise<string[]> {
  if (depth > 2) return [];
  const data = (await notionFetch(`/blocks/${pageId}/children?page_size=100`)) as {
    results?: NotionBlock[];
  };
  const urls: string[] = [];
  for (const block of data.results ?? []) {
    if (block.type === "image") {
      const url = extractUrl(block.image);
      if (url) urls.push(url);
    } else if (block.type === "file" && block.file) {
      // Skip non-image file attachments unless extension looks visual.
      const url = extractUrl(block.file);
      if (url && /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i.test(url)) urls.push(url);
    } else if (block.has_children) {
      try {
        const nested = await collectImagesFromBlocks(block.id, depth + 1);
        urls.push(...nested);
      } catch {
        // ignore nested fetch errors
      }
    }
  }
  return urls;
}

type TextChunk = { kind: "paragraph" | "heading" | "bullet" | "quote"; text: string };

const TEXT_KEYS = [
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "quote",
  "callout",
  "toggle",
] as const;

function richTextToString(rt: NotionRichText[] | undefined): string {
  if (!rt) return "";
  return rt.map((t) => t.plain_text ?? "").join("").trim();
}

async function collectTextFromBlocks(pageId: string, depth = 0): Promise<TextChunk[]> {
  if (depth > 2) return [];
  const data = (await notionFetch(`/blocks/${pageId}/children?page_size=100`)) as {
    results?: NotionBlock[];
  };
  const out: TextChunk[] = [];
  for (const block of data.results ?? []) {
    const key = block.type as (typeof TEXT_KEYS)[number];
    if (TEXT_KEYS.includes(key)) {
      const payload = block[key] as { rich_text?: NotionRichText[] } | undefined;
      const text = richTextToString(payload?.rich_text);
      if (text) {
        if (key.startsWith("heading")) out.push({ kind: "heading", text });
        else if (key === "bulleted_list_item" || key === "numbered_list_item")
          out.push({ kind: "bullet", text });
        else if (key === "quote") out.push({ kind: "quote", text });
        else out.push({ kind: "paragraph", text });
      }
    }
    if (block.has_children && block.type !== "image") {
      try {
        const nested = await collectTextFromBlocks(block.id, depth + 1);
        out.push(...nested);
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function isSectionMarker(text: string): boolean {
  // Notion docs often use "[섹션명]" headers inside paragraphs.
  const t = text.trim();
  return /^\[.+\]\s*$/.test(t) || t.length < 8;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastStop = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("。"),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("…"),
    slice.lastIndexOf("함."),
  );
  return (lastStop > max * 0.5 ? slice.slice(0, lastStop + 1) : slice.trimEnd() + "…").trim();
}

function summarize(chunks: TextChunk[]): { summary: string; highlights: string[] } {
  // Candidate texts for the headline summary, in priority order:
  // 1) first paragraph that isn't a "[section]" label
  // 2) first bullet that is descriptive (>= 24 chars)
  const meaningfulParas = chunks
    .filter((c) => (c.kind === "paragraph" || c.kind === "quote") && !isSectionMarker(c.text))
    .map((c) => c.text);
  const bullets = chunks.filter((c) => c.kind === "bullet").map((c) => c.text);

  let summary = meaningfulParas[0] ?? "";
  if (!summary) summary = bullets.find((b) => b.length >= 24) ?? bullets[0] ?? "";
  summary = clip(summary, 200);

  // Highlights: drop the bullet already used as summary (if any), drop near-dupes
  // and section markers, then clip each line.
  const seen = new Set<string>([summary.trim()]);
  const highlights = bullets
    .filter((b) => b.length >= 8 && !isSectionMarker(b))
    .filter((b) => {
      const key = b.trim().slice(0, 40);
      if (seen.has(b.trim()) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((b) => clip(b, 140))
    .slice(0, 5);

  return { summary, highlights };
}

async function fetchPageImages(pageId: string): Promise<string[]> {
  const urls: string[] = [];
  // 1) page cover (if any)
  try {
    const page = (await notionFetch(`/pages/${pageId}`)) as {
      cover?: NotionImageObj | null;
    };
    const coverUrl = extractUrl(page.cover ?? undefined);
    if (coverUrl) urls.push(coverUrl);
  } catch {
    // ignore — try blocks anyway
  }
  // 2) image blocks (and one level of nesting)
  try {
    urls.push(...(await collectImagesFromBlocks(pageId)));
  } catch {
    // ignore
  }
  // de-dupe preserving order. Notion S3 signed URLs include changing query
  // params (X-Amz-*), so we key by pathname + filename only.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    let key = u;
    try {
      const parsed = new URL(u);
      key = parsed.origin + parsed.pathname;
    } catch {
      // keep raw url as key
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

export type NotionPagePayload = {
  images: string[];
  summary: string;
  highlights: string[];
};

const IMAGE_REORDERS: Record<string, (images: string[]) => string[]> = {
  // Move the first image to the end of the gallery for this project.
  "photogray-shyungshyung": (images) => {
    if (images.length <= 1) return images;
    const [first, ...rest] = images;
    return [...rest, first];
  },
};

export const getNotionPage = createServerFn({ method: "GET" })
  .inputValidator((input: { kind: "project" | "experience"; slug: string }) => input)
  .handler(async ({ data }): Promise<NotionPagePayload> => {
    const map = data.kind === "project" ? PROJECT_PAGE_IDS : EXPERIENCE_PAGE_IDS;
    const pageId = map[data.slug];
    if (!pageId) return { images: [], summary: "", highlights: [] };
    try {
      const [images, chunks] = await Promise.all([
        fetchPageImages(pageId),
        collectTextFromBlocks(pageId).catch(() => [] as TextChunk[]),
      ]);
      const { summary, highlights } = summarize(chunks);
      const reordered = IMAGE_REORDERS[data.slug]?.(images) ?? images;
      return { images: reordered, summary, highlights };
    } catch (err) {
      console.error("[getNotionPage] failed:", err);
      return { images: [], summary: "", highlights: [] };
    }
  });

export function notionPageQueryOptions(kind: "project" | "experience", slug: string) {
  // Bump the version for a specific slug to bust any stale cached payloads
  // (used after a Notion page is re-edited and the old summary is sticking).
  const VERSIONS: Record<string, number> = {
    "daljjanheun-haru": 2,
  };
  const version = VERSIONS[slug] ?? 1;
  const fallback = staticNotionPage(kind, slug);
  const fetchPage = async (): Promise<NotionPagePayload> => {
    try {
      const live = await getNotionPage({ data: { kind, slug } });
      if (live && (live.images.length || live.summary || live.highlights.length)) return live;
    } catch (err) {
      // Static hosting (e.g. GitHub Pages) has no server function at all.
      console.error("[notion] fetch failed:", err);
    }
    return fallback ?? { images: [], summary: "", highlights: [] };
  };
  return {
    queryKey: ["notion-page", kind, slug, version] as const,
    queryFn: fetchPage,
    // No initialData: let the UI show its loading skeleton while fetching
    // instead of flashing the static snapshot. The snapshot is returned
    // only after a real fetch failure (e.g. GitHub Pages).
    // Always refetch on mount so Notion edits show up immediately.
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
  };
}