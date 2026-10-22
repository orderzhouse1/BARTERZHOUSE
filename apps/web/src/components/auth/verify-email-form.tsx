'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { FormAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAuthErrorMessage, type Dictionary } from '@/i18n/dictionaries';
import { ApiError, apiClient } from '@/lib/api-client';
import { isValidEmail } from '@/lib/validation';

type VerifyEmailFormProps = {
  locale: Locale;
  dictionary: Dictionary;
};

type VerifyState = 'verifying' | 'success' | 'error' | 'idle';

function ResendForm({ locale, dictionary }: VerifyEmailFormProps) {
  const searchParams = useSearchParams();
  const t = dictionary.auth.verifyEmail;

  const [email, setEmail] = React.useState(searchParams.get('email') ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !isValidEmail(email)) {
      setError(dictionary.auth.validation.emailInvalid);
      return;
    }
    setError(null);

    setSubmitting(true);
    try {
      await apiClient.resendVerification(email.trim());
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? getAuthErrorMessage(dictionary, err.code)
          : dictionary.common.genericError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return <FormAlert variant="success" message={t.resendSuccess} />;
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <p className="text-sm text-[var(--muted-foreground)]">{t.resendBody}</p>
      {formError ? <FormAlert variant="error" message={formError} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="resend-email">{t.emailLabel}</Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(error)}
          aria-describedby={error ? 'resend-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError id="resend-email-error" message={error} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t.resendSubmitting : t.resendSubmit}
      </Button>

      <p className="text-center text-sm">
        <Link
          href={`/${locale}/login`}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {t.goToLogin}
        </Link>
      </p>
    </form>
  );
}

export function VerifyEmailForm({ locale, dictionary }: VerifyEmailFormProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = dictionary.auth.verifyEmail;

  const [state, setState] = React.useState<VerifyState>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (!token || attemptedRef.current) {
      return;
    }
    attemptedRef.current = true;

    apiClient
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof ApiError
            ? getAuthErrorMessage(dictionary, error.code)
            : dictionary.common.genericError,
        );
        setState('error');
      });
  }, [token, dictionary]);

  if (state === 'verifying') {
    return <p className="text-center text-sm text-[var(--muted-foreground)]">{t.verifying}</p>;
  }

  if (state === 'success') {
    return (
      <div className="space-y-5 text-center">
        <FormAlert variant="success" message={t.successBody} />
        <Button asChild size="lg" className="w-full">
          <Link href={`/${locale}/account`}>{t.goToAccount}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-6">
        <FormAlert variant="error" message={errorMessage ?? dictionary.common.genericError} />
        <ResendForm locale={locale} dictionary={dictionary} />
      </div>
    );
  }

  return <ResendForm locale={locale} dictionary={dictionary} />;
}
