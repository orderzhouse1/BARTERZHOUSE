'use client';

import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  showPasswordLabel: string;
  hidePasswordLabel: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showPasswordLabel, hidePasswordLabel, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pe-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
