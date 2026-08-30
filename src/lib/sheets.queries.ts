import type { SheetDetail } from "./sheets.functions";
import { getProjectSheetDetail, getExperienceSheetDetail } from "./sheets.functions";
import { STATIC_PROJECT_SHEETS, STATIC_EXPERIENCE_SHEETS } from "./static-sheet-data";

/**
 * Never let a transient server-fn/network failure break the page or the poll loop.
 * On static hosting (e.g. GitHub Pages) the server function does not exist at all,
 * so we fall back to the committed snapshot of the sheet.
 */
async function safeCall(
  fn: () => Promise<SheetDetail>,
  fallback: SheetDetail,
): Promise<SheetDetail> {
  try {
    const result = await fn();
    return result ?? fallback;
  } catch (err) {
    console.error("[sheets] fetch failed:", err);
    return fallback;
  }
}

export function projectSheetQueryOptions(slug: string) {
  const fallback = STATIC_PROJECT_SHEETS[slug] ?? null;
  return {
    queryKey: ["project-sheet", slug] as const,
    queryFn: () => safeCall(() => getProjectSheetDetail({ data: { slug } }), fallback),
    // No initialData: show a loading state while fetching instead of
    // flashing the static snapshot. The snapshot is only used after a
    // real failure (e.g. static hosting without server functions).
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always" as const,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: false,
  };
}

export function experienceSheetQueryOptions(slug: string) {
  const fallback = STATIC_EXPERIENCE_SHEETS[slug] ?? null;
  return {
    queryKey: ["experience-sheet", slug] as const,
    queryFn: () => safeCall(() => getExperienceSheetDetail({ data: { slug } }), fallback),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always" as const,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: false,
  };
}
