type CardVariant = 'elevated' | 'flat';
type CardPadding = 'compact' | 'default' | 'spacious';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantClasses: Record<CardVariant, string> = {
  elevated: 'bg-surface shadow',
  flat: 'bg-surface border border-border',
};

const paddingClasses: Record<CardPadding, string> = {
  compact: 'p-3',
  default: 'p-4',
  spacious: 'p-6',
};

export default function Card({
  variant = 'elevated',
  padding = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-lg',
        variantClasses[variant],
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
