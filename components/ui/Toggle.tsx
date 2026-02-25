type ToggleSize = 'sm' | 'md';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: ToggleSize;
  disabled?: boolean;
}

const trackSize: Record<ToggleSize, string> = {
  sm: 'w-8 h-5',
  md: 'w-10 h-6',
};

const knobSize: Record<ToggleSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

const knobTranslate: Record<ToggleSize, string> = {
  sm: 'translate-x-3',
  md: 'translate-x-4',
};

export default function Toggle({
  checked,
  onChange,
  label,
  size = 'md',
  disabled = false,
}: ToggleProps) {
  return (
    <label
      className={[
        'inline-flex items-center gap-2 select-none',
        disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer',
      ].join(' ')}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex shrink-0 items-center rounded-full p-0.5',
          'transition-colors duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          trackSize[size],
          checked ? 'bg-accent' : 'bg-border-strong',
        ].join(' ')}
      >
        <span
          className={[
            'block rounded-full bg-white shadow-sm',
            'transition-transform duration-150 ease-out',
            knobSize[size],
            checked ? knobTranslate[size] : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      {label && (
        <span className="text-base text-text-primary">{label}</span>
      )}
    </label>
  );
}
