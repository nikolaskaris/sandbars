type SkeletonVariant = 'text' | 'card' | 'circle';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  card: 'h-32 w-full rounded-lg',
  circle: 'h-10 w-10 rounded-full',
};

export default function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div
      className={[
        'relative overflow-hidden bg-surface-secondary',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-surface-secondary via-surface to-surface-secondary" />
    </div>
  );
}
