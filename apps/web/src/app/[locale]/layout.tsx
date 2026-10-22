import { notFound } from 'next/navigation';

import { getLocaleDirection, isLocale, SUPPORTED_LOCALES, type Locale } from '@barterzhouse/shared';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const direction = getLocaleDirection(locale);

  return (
    <div lang={locale} dir={direction} className="min-h-dvh">
      {children}
    </div>
  );
}
