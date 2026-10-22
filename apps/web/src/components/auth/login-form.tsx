'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { FormAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { getAuthErrorMessage, type Dictionary } from '@/i18n/dictionaries';
import { ApiError, apiClient } from '@/lib/api-client';
import { isValidEmail, sanitizeNextPath } from '@/lib/validation';

type LoginFormProps = {
  locale: Locale;
  dictionary: Dictionary;
};

type FormValues = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues, dictionary: Dictionary): FormErrors {
  const errors: FormErrors = {};

  if (!values.email.trim()) {
    errors.email = dictionary.auth.validation.emailRequired;
  } else if (!isValidEmail(values.email)) {
    errors.email = dictionary.auth.validation.emailInvalid;
  }

  if (!values.password) {
    errors.password = dictionary.auth.validation.passwordRequired;
  }

  return errors;
}

export function LoginForm({ locale, dictionary }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = dictionary.auth.login;

  const [values, setValues] = React.useState<FormValues>({ email: '', password: '' });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validationErrors = validate(values, dictionary);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.login({ email: values.email.trim(), password: values.password });
      const next = sanitizeNextPath(searchParams.get('next'), `/${locale}/account`);
      router.replace(next);
      router.refresh();
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

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {formError ? <FormAlert variant="error" message={formError} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="login-email">{t.emailLabel}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={values.email}
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
        />
        <FieldError id="login-email-error" message={errors.email} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="login-password">{t.passwordLabel}</Label>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            {t.forgotPasswordLink}
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          value={values.password}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          showPasswordLabel={dictionary.common.showPassword}
          hidePasswordLabel={dictionary.common.hidePassword}
          onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
        />
        <FieldError id="login-password-error" message={errors.password} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </Button>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        {t.registerPrompt}{' '}
        <Link
          href={`/${locale}/register`}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {t.registerLink}
        </Link>
      </p>
    </form>
  );
}
