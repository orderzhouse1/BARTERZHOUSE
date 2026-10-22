import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { RegisterForm } from '@/components/auth/register-form';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: RegisterPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.auth.register.title,
  };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return (
    <AuthPageShell
      locale={locale}
      dictionary={dictionary}
      title={dictionary.auth.register.title}
      subtitle={dictionary.auth.register.subtitle}
    >
      <RegisterForm locale={locale} dictionary={dictionary} />
    </AuthPageShell>
  );
}
