type BadgeVariant = 'quality' | 'status' | 'neutral';
type BadgeSize = 'sm' | 'md';
type StatusType = 'success' | 'warning' | 'error';

interface BadgeBaseProps {
  size?: BadgeSize;
  className?: string;
}

interface QualityBadgeProps extends BadgeBaseProps {
  variant: 'quality';
  score: number;
}

interface StatusBadgeProps extends BadgeBaseProps {
  variant: 'status';
  status: StatusType;
  children: React.ReactNode;
}

interface NeutralBadgeProps extends BadgeBaseProps {
  variant?: 'neutral';
  children: React.ReactNode;
}

type BadgeProps = QualityBadgeProps | StatusBadgeProps | NeutralBadgeProps;

function getQualityLevel(score: number): { label: string; classes: string } {
  if (score >= 81) return { label: 'Epic', classes: 'bg-quality-epic text-white' };
  if (score >= 61) return { label: 'Great', classes: 'bg-quality-great text-white' };
  if (score >= 41) return { label: 'Good', classes: 'bg-quality-good text-white' };
  if (score >= 21) return { label: 'Fair', classes: 'bg-quality-fair text-text-primary' };
  return { label: 'Poor', classes: 'bg-quality-poor text-white' };
}

const statusClasses: Record<StatusType, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-sm',
};

export default function Badge(props: BadgeProps) {
  const { size = 'sm', className } = props;

  let content: React.ReactNode;
  let variantClasses: string;

  if (props.variant === 'quality') {
    const { label, classes } = getQualityLevel(props.score);
    content = label;
    variantClasses = classes;
  } else if (props.variant === 'status') {
    content = props.children;
    variantClasses = statusClasses[props.status];
  } else {
    content = props.children;
    variantClasses = 'bg-surface-secondary text-text-secondary';
  }

  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full leading-data whitespace-nowrap',
        sizeClasses[size],
        variantClasses,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {content}
    </span>
  );
}
