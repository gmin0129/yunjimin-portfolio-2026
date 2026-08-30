/**
 * Shared loading indicator shown while live Google Sheets / Notion content
 * is being fetched, so the static fallback never flashes on screen.
 */
export function ContentLoading({ label = "내용을 불러오는 중입니다…" }: { label?: string }) {
  return (
    <div
      className="px-6 py-24 flex flex-col items-center justify-center gap-4 text-[var(--ink-soft)]"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--terracotta)] border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
