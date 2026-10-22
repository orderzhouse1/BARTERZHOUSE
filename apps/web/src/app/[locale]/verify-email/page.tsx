import { Suspense } from 'react';

import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: VerifyEmailPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.verifyEmail.title,
  };
}

export default async function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AuthPageShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.auth.verifyEmail.title}
    >
      <Suspense fallback={null}>
        <VerifyEmailForm locale={locale} dictionary={dictionary} />
      </Suspense>
    </AuthPageShell>
  );
}
