'use client';

import Link from 'next/link';
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

type ForgotPasswordFormProps = {
  locale: Locale;
  dictionary: Dictionary;
};

export function ForgotPasswordForm({ locale, dictionary }: ForgotPasswordFormProps) {
  const t = dictionary.auth.forgotPassword;

  const [email, setEmail] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !isValidEmail(email)) {
      setFieldError(dictionary.auth.validation.emailInvalid);
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      await apiClient.forgotPassword(email.trim());
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? getAuthErrorMessage(dictionary, error.code)
          : dictionary.common.genericError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <FormAlert variant="success" message={t.successMessage} />
        <p className="text-center text-sm">
          <Link
            href={`/${locale}/login`}
            className="font-medium text-[var(--primary)] hover:underline"
          >
            {t.backToLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {formError ? <FormAlert variant="error" message={formError} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="forgot-password-email">{t.emailLabel}</Label>
        <Input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? 'forgot-password-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError id="forgot-password-email-error" message={fieldError} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </Button>

      <p className="text-center text-sm">
        <Link
          href={`/${locale}/login`}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {t.backToLogin}
        </Link>
      </p>
    </form>
  );
}
