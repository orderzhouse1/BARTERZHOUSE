import { getWebEnv } from '@/config/env';
import { FoundationPreview } from '@/components/foundation/foundation-preview';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocalePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: `${dictionary.brand} · ${dictionary.phaseLabel}`,
    description: dictionary.supporting,
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  // Validate public env once per request path used in Phase 0.
  getWebEnv();

  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return <FoundationPreview locale={locale} dictionary={dictionary} />;
}
