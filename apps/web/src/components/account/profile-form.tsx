'use client';

import * as React from 'react';

import type { Locale } from '@barterzhouse/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { InitialsAvatar } from '@/components/ui/avatar';
import { FormAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAuthErrorMessage, type Dictionary } from '@/i18n/dictionaries';
import { ApiError, apiClient } from '@/lib/api-client';
import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH } from '@/lib/validation';

type ProfileFormProps = {
  dictionary: Dictionary;
};

type FormValues = {
  displayName: string;
  bio: string;
  city: string;
  area: string;
  preferredLocale: Locale;
};

export function ProfileForm({ dictionary }: ProfileFormProps) {
  const { user, setUser } = useAuth();
  const t = dictionary.account.profile;

  const [values, setValues] = React.useState<FormValues>(() => ({
    displayName: user?.profile.displayName ?? '',
    bio: user?.profile.bio ?? '',
    city: user?.profile.city ?? '',
    area: user?.profile.area ?? '',
    preferredLocale: user?.profile.preferredLocale ?? 'ar',
  }));
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  if (!user) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const displayName = values.displayName.trim();
    if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
      setDisplayNameError(dictionary.auth.validation.displayNameTooShort);
      return;
    }
    if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      setDisplayNameError(dictionary.auth.validation.displayNameTooLong);
      return;
    }
    setDisplayNameError(null);

    setSaving(true);
    try {
      const updated = await apiClient.updateProfile({
        displayName,
        bio: values.bio.trim() || null,
        city: values.city.trim() || null,
        area: values.area.trim() || null,
        preferredLocale: values.preferredLocale,
      });
      setUser(updated);
      setSuccessMessage(t.saveSuccess);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? getAuthErrorMessage(dictionary, error.code)
          : dictionary.common.genericError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <InitialsAvatar name={user.profile.displayName} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t.title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{t.subtitle}</p>
        </div>
      </div>

      <form
        className="space-y-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]"
        noValidate
        onSubmit={handleSubmit}
      >
        {formError ? <FormAlert variant="error" message={formError} /> : null}
        {successMessage ? <FormAlert variant="success" message={successMessage} /> : null}

        <div className="space-y-1.5">
          <Label htmlFor="profile-display-name">{t.displayNameLabel}</Label>
          <Input
            id="profile-display-name"
            value={values.displayName}
            invalid={Boolean(displayNameError)}
            aria-describedby={displayNameError ? 'profile-display-name-error' : undefined}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, displayName: event.target.value }))
            }
          />
          <FieldError id="profile-display-name-error" message={displayNameError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-bio">
            {t.bioLabel}{' '}
            <span className="text-[var(--muted-foreground)]">({dictionary.common.optional})</span>
          </Label>
          <textarea
            id="profile-bio"
            value={values.bio}
            maxLength={500}
            rows={3}
            onChange={(event) => setValues((prev) => ({ ...prev, bio: event.target.value }))}
            className="flex w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-city">
              {t.cityLabel}{' '}
              <span className="text-[var(--muted-foreground)]">({dictionary.common.optional})</span>
            </Label>
            <Input
              id="profile-city"
              value={values.city}
              onChange={(event) => setValues((prev) => ({ ...prev, city: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-area">
              {t.areaLabel}{' '}
              <span className="text-[var(--muted-foreground)]">({dictionary.common.optional})</span>
            </Label>
            <Input
              id="profile-area"
              value={values.area}
              onChange={(event) => setValues((prev) => ({ ...prev, area: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-preferred-locale">{t.preferredLocaleLabel}</Label>
          <select
            id="profile-preferred-locale"
            value={values.preferredLocale}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, preferredLocale: event.target.value as Locale }))
            }
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <option value="ar">{dictionary.auth.register.localeAr}</option>
            <option value="en">{dictionary.auth.register.localeEn}</option>
          </select>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </form>
    </div>
  );
}
