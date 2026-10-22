'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { FormAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { getAuthErrorMessage, type Dictionary } from '@/i18n/dictionaries';
import { ApiError, apiClient } from '@/lib/api-client';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/validation';

type ResetPasswordFormProps = {
  locale: Locale;
  dictionary: Dictionary;
};

type FormErrors = {
  password?: string;
  confirmPassword?: string;
};

export function ResetPasswordForm({ locale, dictionary }: ResetPasswordFormProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = dictionary.auth.resetPassword;
  const v = dictionary.auth.validation;

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  if (!token) {
    return <FormAlert variant="error" message={t.invalidToken} />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FormErrors = {};
    if (!password) {
      nextErrors.password = v.passwordRequired;
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = v.passwordTooShort;
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = v.passwordTooLong;
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = v.confirmPasswordRequired;
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = v.passwordsDoNotMatch;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token as string, password);
      setSuccess(true);
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

  if (success) {
    return (
      <div className="space-y-5">
        <FormAlert variant="success" message={t.successMessage} />
        <Button asChild size="lg" className="w-full">
          <Link href={`/${locale}/login`}>{t.goToLogin}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {formError ? <FormAlert variant="error" message={formError} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="reset-password">{t.passwordLabel}</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          value={password}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'reset-password-error' : undefined}
          showPasswordLabel={dictionary.common.showPassword}
          hidePasswordLabel={dictionary.common.hidePassword}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FieldError id="reset-password-error" message={errors.password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm-password">{t.confirmPasswordLabel}</Label>
        <PasswordInput
          id="reset-confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
          showPasswordLabel={dictionary.common.showPassword}
          hidePasswordLabel={dictionary.common.hidePassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <FieldError id="reset-confirm-password-error" message={errors.confirmPassword} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
