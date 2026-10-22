'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { AuthProvider, useAuth } from '@/components/auth/auth-provider';
import { InitialsAvatar } from '@/components/ui/avatar';
import type { Dictionary } from '@/i18n/dictionaries';
import { apiClient } from '@/lib/api-client';

type AccountShellProps = {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
};

/**
 * This component wraps every /account/* page. It is a UX-only guard: it hides
 * protected UI and redirects unauthenticated visitors client-side. The actual
 * authorization boundary is enforced by the API on every request via the
 * httpOnly session cookies, so this guard is never a substitute for
 * server-side checks.
 */
export function AccountShell({ locale, dictionary, children }: AccountShellProps) {
  return (
    <AuthProvider>
      <AccountGuard locale={locale} dictionary={dictionary}>
        {children}
      </AccountGuard>
    </AuthProvider>
  );
}

function AccountGuard({ locale, dictionary, children }: AccountShellProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      const next = encodeURIComponent(pathname || `/${locale}/account`);
      router.replace(`/${locale}/login?next=${next}`);
    }
  }, [status, router, locale, pathname]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-[var(--muted-foreground)]">{dictionary.account.guard.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <AccountHeader locale={locale} dictionary={dictionary} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function AccountHeader({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const navItems = [
    { href: `/${locale}/account`, label: dictionary.account.nav.overview },
    { href: `/${locale}/account/profile`, label: dictionary.account.nav.profile },
    { href: `/${locale}/account/security`, label: dictionary.account.nav.security },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiClient.logout();
    } catch {
      // Cookies may already be invalid; proceed to clear local state regardless.
    } finally {
      setUser(null);
      router.replace(`/${locale}/login`);
    }
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href={`/${locale}`}
            className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--primary)]"
          >
            {dictionary.account.header.brand}
          </Link>
          <nav className="flex items-center gap-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    isActive
                      ? 'text-sm font-semibold text-[var(--primary)]'
                      : 'text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? <InitialsAvatar name={user.profile.displayName} size="sm" /> : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--destructive)] disabled:opacity-50"
          >
            {dictionary.account.header.logout}
          </button>
        </div>
      </div>
    </header>
  );
}
