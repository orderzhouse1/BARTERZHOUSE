import type { ReactNode } from 'react';

import { AccountShell } from '@/components/account/account-shell';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type AccountLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * NOTE: `AccountShell` performs a client-side-only auth check (GET /auth/me,
 * with one refresh attempt) and redirects to /login when unauthenticated.
 * This is a UX convenience — it can flash a brief loading state and does not
 * run during SSR. The API is the real authorization boundary: every
 * account-related request is independently authorized via httpOnly session
 * cookies, regardless of what this client guard decides to render.
 */
export default async function AccountLayout({ children, params }: AccountLayoutProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AccountShell locale={locale} dictionary={dictionary}>
      {children}
    </AccountShell>
  );
}
