import { ProfileForm } from '@/components/account/profile-form';
import { getDictionary } from '@/i18n/dictionaries';
import { resolveLocale } from '@/lib/locale';

type ProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ProfilePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.account.profile.title,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const dictionary = getDictionary(locale);

  return <ProfileForm dictionary={dictionary} />;
}
