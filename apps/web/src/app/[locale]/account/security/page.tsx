import { SecurityPanel } from '@/components/account/security-panel';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type SecurityPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: SecurityPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.account.security.title,
  };
}

export default async function SecurityPage({ params }: SecurityPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return <SecurityPanel locale={locale} dictionary={dictionary} />;
}
