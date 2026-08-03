'use client';

/**
 * BridgeRing — Zabanyar's signature element.
 *
 * An open arc (not a closed circle) whose fill starts at the RIGHT edge —
 * where Persian reading begins — and travels to the LEFT edge, where English
 * reading begins. The gap at the bottom keeps it reading as a *bridge span*
 * rather than a generic progress donut: the learner is crossing from one
 * language to the other, and the arc shows how far across they are.
 *
 * Used for: daily goal, streak, CEFR level, lesson progress.
 */

const GAP_DEG = 84; // opening at the bottom = the two banks of the bridge

export default function BridgeRing({
  value,
  max = 100,
  size = 88,
  stroke = 8,
  color = 'var(--color-primary-600)',
  track = 'var(--border)',
  label,
  sublabel,
  children,
  ariaLabel,
  className = '',
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: string;
  sublabel?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(1, value / safeMax));

  const r = (size - stroke) / 2;
  const c = size / 2;
  const sweepDeg = 360 - GAP_DEG;
  const circumference = 2 * Math.PI * r;
  const arcLen = (sweepDeg / 360) * circumference;

  // Start at the right-hand end of the span, sweep counter-clockwise
  // (right -> top -> left), i.e. Persian start -> English start.
  const startDeg = 90 - GAP_DEG / 2; // bottom-right, just above the gap
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (deg: number) => [c + r * Math.cos(rad(deg)), c + r * Math.sin(rad(deg))];

  // Decreasing angle in SVG's y-down space = counter-clockwise on screen,
  // i.e. bottom-right -> right -> top -> left -> bottom-left.
  const [x1, y1] = pt(startDeg);
  const [x2, y2] = pt(startDeg - sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(pct * 100)} درصد`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path
          d={d}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          className="bridge-arc"
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeDashoffset={arcLen * (1 - pct)}
          style={
            {
              '--dash-from': `${arcLen}px`,
              '--dash-to': `${arcLen * (1 - pct)}px`,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        {children ?? (
          <>
            {label && <span className="num font-bold">{label}</span>}
            {sublabel && (
              <span className="text-[.65rem]" style={{ color: 'var(--muted)' }}>
                {sublabel}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
