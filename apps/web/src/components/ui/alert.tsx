import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type AlertVariant = 'error' | 'success';

type FormAlertProps = {
  variant: AlertVariant;
  message: string;
  className?: string;
};

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error: 'border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]',
  success: 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]',
};

export function FormAlert({ variant, message, className }: FormAlertProps) {
  const Icon = variant === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
