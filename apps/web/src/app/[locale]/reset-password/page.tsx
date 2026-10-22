import { Suspense } from 'react';

import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ResetPasswordPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.resetPassword.title,
  };
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AuthPageShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.auth.resetPassword.title}
      subtitle={dictionary.auth.resetPassword.subtitle}
    >
      <Suspense fallback={null}>
        <ResetPasswordForm locale={locale} dictionary={dictionary} />
      </Suspense>
    </AuthPageShell>
  );
}
