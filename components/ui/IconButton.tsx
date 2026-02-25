import { forwardRef } from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  'aria-label': string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active = false, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center',
        'h-9 w-9 rounded shadow-sm',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-98',
        active
          ? 'bg-accent-muted text-accent border border-accent'
          : 'bg-surface text-text-secondary border border-border hover:bg-surface-secondary hover:text-text-primary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
export default IconButton;
