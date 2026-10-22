import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ForgotPasswordPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.forgotPassword.title,
  };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AuthPageShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.auth.forgotPassword.title}
      subtitle={dictionary.auth.forgotPassword.subtitle}
    >
      <ForgotPasswordForm locale={locale} dictionary={dictionary} />
    </AuthPageShell>
  );
}
