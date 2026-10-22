import { AccountOverview } from '@/components/account/account-overview';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type AccountOverviewPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AccountOverviewPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.account.overview.title,
  };
}

export default async function AccountOverviewPage({ params }: AccountOverviewPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return <AccountOverview locale={locale} dictionary={dictionary} />;
}
