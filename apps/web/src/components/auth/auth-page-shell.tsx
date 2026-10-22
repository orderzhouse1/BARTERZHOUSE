import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Locale } from '@barterzhouse/shared';

import type { Dictionary } from '@/i18n/dictionaries';

type AuthPageShellProps = {
  locale: Locale;
  dictionary: Dictionary;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Shared centered-card layout for all standalone auth pages
 * (login, register, verify-email, forgot/reset password).
 */
export function AuthPageShell({
  locale,
  dictionary,
  title,
  subtitle,
  children,
}: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md space-y-6">
        <Link
          href={`/${locale}`}
          className="mx-auto flex w-fit flex-col items-center gap-0.5 text-center"
        >
          <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--primary)]">
            {dictionary.brand}
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">{dictionary.brandLatin}</span>
        </Link>

        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
          <div className="mb-6 space-y-1.5 text-center">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
            {subtitle ? <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
