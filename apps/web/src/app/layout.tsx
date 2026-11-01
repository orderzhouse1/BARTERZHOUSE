import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, getLocaleDirection, isLocale, type Locale } from '@barterzhouse/shared';

import './globals.css';

const ibmPlexSans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-400.ttf', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-500.ttf', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-600.ttf', weight: '600', style: 'normal' },
    { path: './fonts/ibm-plex-sans-700.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexSansArabic = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-arabic-400.ttf', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-500.ttf', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-600.ttf', weight: '600', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-700.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
});

const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-600.ttf', weight: '600', style: 'normal' },
    { path: './fonts/fraunces-700.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
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
