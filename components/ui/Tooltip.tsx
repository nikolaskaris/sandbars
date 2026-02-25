type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: TooltipSide;
}

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export default function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        role="tooltip"
        className={[
          'pointer-events-none absolute z-50',
          'rounded bg-tooltip text-white text-sm px-2.5 py-1.5 shadow-md',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150 ease-out',
          'whitespace-nowrap',
          sideClasses[side],
        ].join(' ')}
      >
        {content}
      </div>
    </div>
  );
}
