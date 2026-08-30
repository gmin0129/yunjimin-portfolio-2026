import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { HTMLAttributes } from "react";
import { getExperience, EXPERIENCES, type Experience } from "@/lib/experiences";
import { SwipeTabs } from "@/components/SwipeTabs";
import { useQuery } from "@tanstack/react-query";
import { notionPageQueryOptions } from "@/lib/notion-images.functions";
import { experienceSheetQueryOptions } from "@/lib/sheets.queries";
import { SheetRow } from "@/components/SheetSections";
import { assetUrl } from "@/lib/asset-url";
import { ContentLoading } from "@/components/ContentLoading";


export const Route = createFileRoute("/experiences/$slug")({
  loader: ({ params }) => {
    const experience = getExperience(params.slug);
    if (!experience) throw notFound();
    return { experience };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.experience.title ?? "Experience"} — 윤지민 Portfolio` },
      { name: "description", content: loaderData?.experience.overview ?? loaderData?.experience.blurb ?? "경험 상세" },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-32 text-center">
      <p className="font-serif italic text-[var(--terracotta)]">404</p>
      <h1 className="font-serif text-3xl mt-2">경험을 찾을 수 없어요</h1>
      <Link to="/" hash="experience" className="inline-block mt-6 underline">
        ← Experience로 돌아가기
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="mx-auto max-w-3xl px-6 py-32 text-center">
      <h1 className="font-serif text-3xl">문제가 발생했습니다</h1>
      <button onClick={reset} className="mt-6 underline">다시 시도</button>
    </div>
  ),
  component: ExperienceDetail,
});

function ExperienceDetail() {
  const { experience } = Route.useLoaderData() as { experience: Experience };
  const idx = EXPERIENCES.findIndex((e) => e.slug === experience.slug);
  const prev = EXPERIENCES[(idx - 1 + EXPERIENCES.length) % EXPERIENCES.length];
  const next = EXPERIENCES[(idx + 1) % EXPERIENCES.length];
  const { data, isLoading } = useQuery(notionPageQueryOptions("experience", experience.slug));
  const { data: sheet, isPending: sheetPending } = useQuery(experienceSheetQueryOptions(experience.slug));
  const images = data?.images?.length ? data.images : experience.images;
  const overview = data?.summary?.trim() ? data.summary : experience.overview;
  const role = data?.highlights?.length ? data.highlights : experience.role;
  const hasSheet =
    !!sheet &&
    (sheet.background.fields.length > 0 ||
      sheet.process.fields.length > 0 ||
      sheet.outcome.fields.length > 0);


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[oklch(0.975_0.012_80/0.78)] border-b border-border">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-serif text-lg font-bold tracking-tight">
            윤지민<span className="text-[var(--terracotta)]">.</span>
          </Link>
          <Link to="/" hash="experience" className="text-sm text-[var(--ink-soft)] hover:text-[var(--terracotta)]">
            ← All experiences
          </Link>
        </div>
      </header>

      <TitleCard experience={experience} idx={idx} className="fixed top-16 inset-x-0" />
      <TitleCard experience={experience} idx={idx} className="invisible pointer-events-none" aria-hidden="true" />

      <SwipeTabs
        title={experience.title}
        images={images}
        loading={isLoading}
        hidePhotos={experience.slug === "kosac-2025" || experience.slug === "dyb-choisun"}
      >
      {sheetPending ? (
        <ContentLoading />
      ) : hasSheet ? (
        <section className="mx-auto max-w-5xl px-6 py-16 space-y-12 break-keep">
          {hasSheet ? (
            <>
              <SheetRow title={sheet!.background.title} fields={sheet!.background.fields} layout="four" marker="arrow" />
              <SheetRow title={sheet!.process.title} fields={sheet!.process.fields} layout="two" marker="arrow" />
              <SheetRow title={sheet!.outcome.title} fields={sheet!.outcome.fields} layout="columns" marker="diamond" />
            </>
          ) : (
            <>
              <SheetRow
                title="프로젝트 배경"
                fields={[
                  { label: "기간", value: experience.period },
                  { label: "장소", value: experience.place },
                  ...(overview ? [{ label: "Overview", value: overview }] : []),
                ]}
                layout="four"
                marker="arrow"
              />
              {role && role.length > 0 && (
                <SheetRow
                  title="진행과정"
                  fields={[{ label: "My Role", value: role.join("\n") }]}
                  layout="two"
                  marker="arrow"
                />
              )}
              {experience.outcome && experience.outcome.length > 0 && (
                <SheetRow
                  title="성과 및 인사이트"
                  fields={[{ label: "Outcome", value: experience.outcome.join("\n") }]}
                  layout="columns"
                  marker="diamond"
                />
              )}
            </>
          )}
        </section>
      ) : (
      <section className="mx-auto max-w-5xl px-6 py-16 grid md:grid-cols-3 gap-12">

        <aside className="space-y-6 text-sm">
          <Meta k="기간" v={experience.period} />
          <Meta k="장소" v={experience.place} />
          {experience.pdf && (
            <a
              href={assetUrl(experience.pdf.url)}
              target="_blank"
              rel="noopener noreferrer"
              download={`${experience.slug}.pdf`}
              className="group block rounded-2xl border border-border bg-background/60 backdrop-blur p-4 hover:border-[var(--terracotta)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--terracotta)]/10 text-[var(--terracotta)] font-serif text-xs font-bold">
                  PDF
                </div>
                <div className="min-w-0">
                  <div className="uppercase tracking-widest text-xs text-[var(--ink-soft)]">
                    기획서
                  </div>
                  <div className="mt-0.5 text-foreground group-hover:text-[var(--terracotta)] transition-colors truncate">
                    {experience.pdf.label}
                  </div>
                </div>
                <span className="ml-auto text-[var(--ink-soft)] group-hover:text-[var(--terracotta)] transition-colors">↗</span>
              </div>
            </a>
          )}
        </aside>
        <div className="md:col-span-2 space-y-12">
          {overview && (
            <div>
              <h2 className="font-serif text-2xl mb-3">Overview</h2>
              <p className="text-[var(--ink-soft)] leading-relaxed">{overview}</p>
            </div>
          )}
          {role && role.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl mb-3">My Role</h2>
              <ul className="space-y-2 text-[var(--ink-soft)]">
                {role.map((r) => (
                  <li key={r} className="flex gap-3">
                    <span className="text-[var(--terracotta)]">→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {experience.outcome && experience.outcome.length > 0 && (
            <div>
              <h2 className="font-serif text-2xl mb-3">Outcome</h2>
              <ul className="space-y-2 text-[var(--ink-soft)]">
                {experience.outcome.map((o) => (
                  <li key={o} className="flex gap-3">
                    <span className="text-[var(--terracotta)]">✦</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      )}
      </SwipeTabs>


      <nav className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-10 flex items-center justify-between gap-6">
          <Link
            to="/experiences/$slug"
            params={{ slug: prev.slug }}
            className="group text-left"
          >
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">← Prev</div>
            <div className="font-serif text-lg group-hover:text-[var(--terracotta)] transition-colors">
              {prev.title}
            </div>
          </Link>
          <Link
            to="/experiences/$slug"
            params={{ slug: next.slug }}
            className="group text-right"
          >
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">Next →</div>
            <div className="font-serif text-lg group-hover:text-[var(--terracotta)] transition-colors">
              {next.title}
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-border pb-3">
      <div className="uppercase tracking-widest text-xs text-[var(--ink-soft)]">{k}</div>
      <div className="mt-1 text-foreground">{v}</div>
    </div>
  );
}

function TitleCard({ experience, idx, className, ...props }: { experience: Experience; idx: number } & HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`top-16 z-40 bg-background pb-4 shadow-[0_8px_30px_-12px_oklch(0.3_0.05_40/0.12)] ${className ?? ""}`}>
      <div className="mx-auto max-w-5xl px-4 md:px-6 pt-4">
        <div className={`relative ${TILES[(idx + 2) % TILES.length]} shape-squircle px-6 md:px-10 py-7 md:py-9 clay overflow-hidden animate-galaxy-pulse shadow-lg`}>
          <div className="absolute inset-0 grain opacity-30 pointer-events-none" />
          <div className="relative">
            <div className="font-serif italic text-foreground/75 text-sm tracking-widest uppercase">
              Experience · {String(idx + 1).padStart(2, "0")}
            </div>
            <h1 className="font-serif text-3xl md:text-5xl font-semibold mt-2 leading-[1.1] text-foreground drop-shadow-[1px_1px_0_oklch(1_0_0/0.55)]">
              {experience.title}
            </h1>
            <p className="mt-2 text-foreground/80 text-base md:text-lg">{experience.place}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Matches the Experience cards on the home page (TILES[(i + 2) % 6]).
const TILES = ["tile-1", "tile-2", "tile-3", "tile-4", "tile-5", "tile-6"];