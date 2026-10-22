import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/auth-session';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
};

type InitialsAvatarProps = {
  name: string;
  size?: AvatarSize;
  className?: string;
};

export function InitialsAvatar({ name, size = 'md', className }: InitialsAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] font-semibold text-[var(--secondary-foreground)]',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
