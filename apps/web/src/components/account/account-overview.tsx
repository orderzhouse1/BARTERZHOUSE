'use client';

import Link from 'next/link';

import type { Locale } from '@barterzhouse/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { InitialsAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/i18n/dictionaries';
import { isEmailVerified } from '@/lib/auth-session';

type AccountOverviewProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function AccountOverview({ locale, dictionary }: AccountOverviewProps) {
  const { user } = useAuth();
  const t = dictionary.account.overview;

  if (!user) {
    return null;
  }

  const verified = isEmailVerified(user);
  const memberSince = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(user.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{t.title}</h1>

      <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <InitialsAvatar name={user.profile.displayName} size="lg" />
        <div className="space-y-1">
          <p className="text-lg font-semibold text-[var(--foreground)]">
            {t.welcome} {user.profile.displayName}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t.emailLabel}: {user.email}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={verified ? 'success' : 'outline'}>
              {verified ? t.verifiedBadge : t.unverifiedBadge}
            </Badge>
            <span className="text-xs text-[var(--muted-foreground)]">
              {t.memberSince} {memberSince}
            </span>
          </div>
        </div>
      </section>

      {!verified ? (
        <section className="border-[var(--warning)]/40 bg-[var(--warning)]/10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-4">
          <p className="text-sm text-[var(--foreground)]">{t.verifyPrompt}</p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${locale}/verify-email?email=${encodeURIComponent(user.email)}`}>
              {t.verifyLink}
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/${locale}/account/profile`}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--surface-elevated)]"
        >
          <p className="font-semibold text-[var(--foreground)]">{t.manageProfile}</p>
        </Link>
        <Link
          href={`/${locale}/account/security`}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--surface-elevated)]"
        >
          <p className="font-semibold text-[var(--foreground)]">{t.manageSecurity}</p>
        </Link>
      </section>
    </div>
  );
}
