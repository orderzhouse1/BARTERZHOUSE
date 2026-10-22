import Link from 'next/link';

import type { Locale } from '@barterzhouse/shared';

import { BarterComparisonPreview } from '@/components/foundation/barter-comparison-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n/dictionaries';

type LocaleSwitcherProps = {
  locale: Locale;
  label: string;
};

function LocaleSwitcher({ locale, label }: LocaleSwitcherProps) {
  const nextLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/${nextLocale}`} hrefLang={nextLocale} lang={nextLocale}>
        {label}
      </Link>
    </Button>
  );
}

type FoundationPreviewProps = {
  locale: Locale;
  dictionary: Dictionary;
};

/**
 * Phase 0 foundation preview page content.
 * Validates design tokens, typography, RTL/LTR, and responsive layout.
 * Not the final landing page and not real marketplace functionality.
 */
export function FoundationPreview({ locale, dictionary }: FoundationPreviewProps) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="outline">{dictionary.phaseLabel}</Badge>
            <div>
              <p className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--primary)] sm:text-5xl">
                {dictionary.brand}
              </p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{dictionary.brandLatin}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${locale}/login`}>{dictionary.nav.login}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/register`}>{dictionary.nav.register}</Link>
            </Button>
            <LocaleSwitcher locale={locale} label={dictionary.switchLocale} />
          </div>
        </header>

        <main className="space-y-8">
          <section className="max-w-2xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{dictionary.badgeTrust}</Badge>
              <Badge variant="accent">{dictionary.badgePreview}</Badge>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl">
              {dictionary.headline}
            </h1>
            <p className="text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
              {dictionary.supporting}
            </p>
          </section>

          <BarterComparisonPreview dictionary={dictionary} />

          <section className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button type="button" size="lg" disabled aria-disabled="true">
              {dictionary.sampleCta}
            </Button>
            <p className="text-sm text-[var(--muted-foreground)]">{dictionary.sampleCtaHint}</p>
          </section>
        </main>
      </div>
    </div>
  );
}
