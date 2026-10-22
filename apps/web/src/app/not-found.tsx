import Link from 'next/link';

import { DEFAULT_LOCALE } from '@barterzhouse/shared';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-start justify-center gap-4 px-4">
      <p className="text-sm font-medium text-[var(--muted-foreground)]">404</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--foreground)]">
        Locale or page not found
      </h1>
      <p className="text-[var(--muted-foreground)]">
        Supported locales are <code>ar</code> and <code>en</code>.
      </p>
      <Button asChild>
        <Link href={`/${DEFAULT_LOCALE}`}>Return to Arabic foundation preview</Link>
      </Button>
    </main>
  );
}
