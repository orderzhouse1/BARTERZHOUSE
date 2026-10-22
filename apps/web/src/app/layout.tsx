import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, getLocaleDirection, isLocale, type Locale } from '@barterzhouse/shared';

import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Baddelha / بدّلها',
    template: '%s · Baddelha',
  },
  description: 'Arabic-first barter marketplace — Baddelha / بدّلها',
};

async function resolveHtmlLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get('x-barter-locale');
  if (fromHeader && isLocale(fromHeader)) {
    return fromHeader;
  }
  return DEFAULT_LOCALE;
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await resolveHtmlLocale();
  const direction = getLocaleDirection(locale);

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${ibmPlexSans.variable} ${ibmPlexSansArabic.variable} ${fraunces.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
