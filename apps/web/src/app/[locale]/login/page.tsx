import { Suspense } from 'react';

import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { LoginForm } from '@/components/auth/login-form';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LoginPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.login.title,
  };
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AuthPageShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.auth.login.title}
      subtitle={dictionary.auth.login.subtitle}
    >
      <Suspense fallback={null}>
        <LoginForm locale={locale} dictionary={dictionary} />
      </Suspense>
    </AuthPageShell>
  );
}
