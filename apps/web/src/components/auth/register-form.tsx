'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
} from '@/lib/validation';

type RegisterFormProps = {
  locale: Locale;
  dictionary: Dictionary;
};

type FormValues = {
  displayName: string;
  email: string;
  password: string;
  preferredLocale: Locale;
  acceptTerms: boolean;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues, dictionary: Dictionary): FormErrors {
  const errors: FormErrors = {};
  const v = dictionary.auth.validation;

  const displayName = values.displayName.trim();
  if (!displayName) {
    errors.displayName = v.displayNameRequired;
  } else if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    errors.displayName = v.displayNameTooShort;
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = v.displayNameTooLong;
  }

  if (!values.email.trim()) {
    errors.email = v.emailRequired;
  } else if (!isValidEmail(values.email)) {
    errors.email = v.emailInvalid;
  }

  if (!values.password) {
    errors.password = v.passwordRequired;
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = v.passwordTooShort;
  } else if (values.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = v.passwordTooLong;
  }

  if (!values.acceptTerms) {
    errors.acceptTerms = v.acceptTermsRequired;
  }

  return errors;
}

export function RegisterForm({ locale, dictionary }: RegisterFormProps) {
  const router = useRouter();
  const t = dictionary.auth.register;

  const [values, setValues] = React.useState<FormValues>({
    displayName: '',
    email: '',
    password: '',
    preferredLocale: locale,
    acceptTerms: false,
  });
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
      await apiClient.register({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        password: values.password,
        preferredLocale: values.preferredLocale,
        acceptTerms: true,
      });
      router.replace(`/${locale}/verify-email?email=${encodeURIComponent(values.email.trim())}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        const fieldErrors: FormErrors = {};
        if (error.fieldErrors.email) fieldErrors.email = error.fieldErrors.email[0];
        if (error.fieldErrors.password) fieldErrors.password = error.fieldErrors.password[0];
        if (error.fieldErrors.displayName)
          fieldErrors.displayName = error.fieldErrors.displayName[0];
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
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
        <Label htmlFor="register-display-name">{t.displayNameLabel}</Label>
        <Input
          id="register-display-name"
          autoComplete="name"
          value={values.displayName}
          invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? 'register-display-name-error' : undefined}
          onChange={(event) => setValues((prev) => ({ ...prev, displayName: event.target.value }))}
        />
        <FieldError id="register-display-name-error" message={errors.displayName} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-email">{t.emailLabel}</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          value={values.email}
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
        />
        <FieldError id="register-email-error" message={errors.email} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-password">{t.passwordLabel}</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          value={values.password}
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'register-password-error' : 'register-password-hint'}
          showPasswordLabel={dictionary.common.showPassword}
          hidePasswordLabel={dictionary.common.hidePassword}
          onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
        />
        {errors.password ? (
          <FieldError id="register-password-error" message={errors.password} />
        ) : (
          <p id="register-password-hint" className="text-sm text-[var(--muted-foreground)]">
            {t.passwordHint}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-preferred-locale">{t.preferredLocaleLabel}</Label>
        <select
          id="register-preferred-locale"
          value={values.preferredLocale}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, preferredLocale: event.target.value as Locale }))
          }
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <option value="ar">{t.localeAr}</option>
          <option value="en">{t.localeEn}</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <input
            id="register-accept-terms"
            type="checkbox"
            checked={values.acceptTerms}
            aria-describedby={errors.acceptTerms ? 'register-accept-terms-error' : undefined}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, acceptTerms: event.target.checked }))
            }
            className="mt-0.5 size-4 shrink-0 rounded-[var(--radius-sm)] border-[var(--border)] text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          />
          <Label htmlFor="register-accept-terms" className="font-normal">
            {t.acceptTermsLabel}
          </Label>
        </div>
        <FieldError id="register-accept-terms-error" message={errors.acceptTerms} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </Button>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        {t.loginPrompt}{' '}
        <Link
          href={`/${locale}/login`}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {t.loginLink}
        </Link>
      </p>
    </form>
  );
}
