import { ArrowLeftRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Dictionary } from '@/i18n/dictionaries';

type BarterComparisonPreviewProps = {
  dictionary: Dictionary;
};

/**
 * Phase 0 foundation preview only.
 * Static visual for design-token / layout validation — not marketplace functionality.
 */
export function BarterComparisonPreview({ dictionary }: BarterComparisonPreviewProps) {
  return (
    <section
      aria-label={dictionary.exchangeHint}
      className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="success">{dictionary.badgeExchange}</Badge>
        <p className="text-sm text-[var(--muted-foreground)]">{dictionary.exchangeHint}</p>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <article className="flex flex-col rounded-[var(--radius-lg)] bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--border)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {dictionary.yourItem}
          </p>
          <div
            className="mb-3 aspect-[4/3] rounded-[var(--radius-md)] bg-[linear-gradient(145deg,var(--primary)_0%,color-mix(in_oklab,var(--primary)_55%,var(--accent))_100%)] opacity-90"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            {dictionary.yourItemName}
          </h3>
        </article>

        <div className="flex items-center justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-foreground)] shadow-[var(--shadow-sm)] motion-safe:animate-[pulse-soft_2.8s_ease-in-out_infinite]"
            aria-hidden="true"
          >
            <ArrowLeftRight className="size-5" strokeWidth={2} />
          </div>
          <span className="sr-only">{dictionary.badgeExchange}</span>
        </div>

        <article className="flex flex-col rounded-[var(--radius-lg)] bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--border)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {dictionary.theirItem}
          </p>
          <div
            className="mb-3 aspect-[4/3] rounded-[var(--radius-md)] bg-[linear-gradient(145deg,var(--accent)_0%,color-mix(in_oklab,var(--accent)_50%,var(--primary))_100%)] opacity-90"
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            {dictionary.theirItemName}
          </h3>
        </article>
      </div>
    </section>
  );
}
