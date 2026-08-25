interface IconProps { className?: string }

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function HomeIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path {...stroke} d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function LiveIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <path {...stroke} d="M3 17l5-6 4 3 5-7 4 4" />
      <circle {...stroke} cx="8" cy="11" r="1.6" />
    </svg>
  );
}

export function LegionIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...p}>
      <circle {...stroke} cx="12" cy="8" r="3.4" />
      <path {...stroke} d="M5 20c.7-3.6 3.5-5.4 7-5.4S18.3 16.4 19 20" />
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

export function GridIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...p}>
      <rect {...stroke} x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect {...stroke} x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect {...stroke} x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect {...stroke} x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...p}>
      <path {...stroke} d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
