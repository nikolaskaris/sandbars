import { forwardRef } from 'react';

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  ticks?: { value: number; label?: string }[];
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, ticks, className, id, ...props }, ref) => {
    const sliderId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
        {label && (
          <label
            htmlFor={sliderId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={sliderId}
          type="range"
          className="w-full"
          {...props}
        />
        {ticks && ticks.length > 0 && (
          <div className="relative w-full h-4">
            {ticks.map((tick) => {
              const min = Number(props.min ?? 0);
              const max = Number(props.max ?? 100);
              const pct = ((tick.value - min) / (max - min)) * 100;
              return (
                <span
                  key={tick.value}
                  className="absolute -translate-x-1/2 text-xs text-text-tertiary"
                  data-position={`${pct}%`}
                >
                  {tick.label ?? tick.value}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);

Slider.displayName = 'Slider';
export default Slider;
