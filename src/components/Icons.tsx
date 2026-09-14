interface IconProps { className?: string }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function OverviewIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <rect {...stroke} x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path {...stroke} d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5.5" />
    </svg>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path {...stroke} d="M12 3.5 19 6v6c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6z" />
    </svg>
  );
}

export function RadarIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle {...stroke} cx="12" cy="12" r="8.2" />
      <circle {...stroke} cx="12" cy="12" r="3.6" />
      <path {...stroke} d="M12 12 18 7" />
    </svg>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...p}>
      <circle {...stroke} cx="12" cy="12" r="3.2" />
      <path {...stroke} d="M19.4 13.6a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" />
    </svg>
  );
}

export function TableIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...p}>
      <rect {...stroke} x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path {...stroke} d="M3.5 9.5h17M3.5 14.5h17M9 9.5V19.5" />
    </svg>
  );
}
