import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE } from '@barterzhouse/shared';

export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
