import { forwardRef } from 'react';
import { Search, type LucideIcon } from 'lucide-react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'search';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, variant = 'default', className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const ResolvedIcon = variant === 'search' ? Search : Icon;

    return (
      <div className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {ResolvedIcon && (
            <ResolvedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded bg-surface border text-text-primary text-base placeholder:text-text-tertiary',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:opacity-40 disabled:pointer-events-none',
              ResolvedIcon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              error ? 'border-error' : 'border-border hover:border-border-strong',
            ].join(' ')}
            {...props}
          />
        </div>
        {error && (
          <span className="text-sm text-error">{error}</span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
