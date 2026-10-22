'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { FormAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getAuthErrorMessage, type Dictionary } from '@/i18n/dictionaries';
import { ApiError, apiClient } from '@/lib/api-client';

type SecurityPanelProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function SecurityPanel({ locale, dictionary }: SecurityPanelProps) {
  const { setUser } = useAuth();
  const router = useRouter();
  const t = dictionary.account.security;

  const [pendingAction, setPendingAction] = React.useState<
    'logout' | 'logout-all' | 'deactivate' | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  async function handleLogout() {
    setError(null);
    setPendingAction('logout');
    try {
      await apiClient.logout();
      setUser(null);
      router.replace(`/${locale}/login`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? getAuthErrorMessage(dictionary, err.code)
          : dictionary.common.genericError,
      );
      setPendingAction(null);
    }
  }

  async function handleLogoutAll() {
    setError(null);
    setPendingAction('logout-all');
    try {
      await apiClient.logoutAll();
      setUser(null);
      router.replace(`/${locale}/login`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? getAuthErrorMessage(dictionary, err.code)
          : dictionary.common.genericError,
      );
      setPendingAction(null);
    }
  }

  async function handleDeactivate() {
    setError(null);
    setPendingAction('deactivate');
    try {
      await apiClient.deactivateAccount();
      setDialogOpen(false);
      setUser(null);
      router.replace(`/${locale}/login`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? getAuthErrorMessage(dictionary, err.code)
          : dictionary.common.genericError,
      );
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t.title}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{t.subtitle}</p>
      </div>

      {error ? <FormAlert variant="error" message={error} /> : null}

      <section className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">{t.sessionsTitle}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{t.sessionsBody}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'logout' ? t.loggingOut : t.logoutButton}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogoutAll}
            disabled={pendingAction !== null}
          >
            {pendingAction === 'logout-all' ? t.loggingOut : t.logoutAllButton}
          </Button>
        </div>
      </section>

      <section className="border-[var(--destructive)]/30 space-y-4 rounded-[var(--radius-xl)] border bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
        <div>
          <h2 className="font-semibold text-[var(--destructive)]">{t.dangerZoneTitle}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{t.dangerZoneBody}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="hover:bg-[var(--destructive)]/10 border-[var(--destructive)] text-[var(--destructive)]"
            >
              {t.deactivateButton}
            </Button>
          </DialogTrigger>
          <DialogContent closeLabel={dictionary.common.cancel}>
            <DialogHeader>
              <DialogTitle>{t.deactivateDialogTitle}</DialogTitle>
              <DialogDescription>{t.deactivateDialogBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={pendingAction === 'deactivate'}
              >
                {t.deactivateCancel}
              </Button>
              <Button
                type="button"
                onClick={handleDeactivate}
                disabled={pendingAction === 'deactivate'}
                className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-110"
              >
                {pendingAction === 'deactivate' ? t.deactivating : t.deactivateConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
