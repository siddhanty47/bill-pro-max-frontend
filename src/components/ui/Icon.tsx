import type { ReactNode } from 'react';

export type IconName =
  | 'dashboard'
  | 'inventory'
  | 'parties'
  | 'agreements'
  | 'challans'
  | 'bills'
  | 'payments'
  | 'team'
  | 'search'
  | 'bell'
  | 'chat'
  | 'chevron-down'
  | 'plus'
  | 'close'
  | 'menu'
  | 'arrow-right'
  | 'rupee'
  | 'settings'
  | 'logout'
  | 'brand';

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

// All glyphs share an 18-unit viewBox, stroke 1.5, round caps/joins.
// `brand` is the scaffold mark on a 22-unit viewBox with stroke 2.
const GLYPHS: Record<Exclude<IconName, 'brand'>, ReactNode> = {
  dashboard: (
    <>
      <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="10" y="2.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="2.5" y="10" width="5.5" height="5.5" rx="1.5" />
      <rect x="10" y="10" width="5.5" height="5.5" rx="1.5" />
    </>
  ),
  inventory: <path d="M4 2.5v13M14 2.5v13M4 6.5h10M4 11.5h10M4 6.5l10 5" />,
  parties: (
    <>
      <circle cx="7" cy="6.5" r="3" />
      <path d="M1.5 15.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5" />
      <path d="M12 3.6a3 3 0 0 1 0 5.8M14 11.4c1.3.6 2.2 2 2.5 4.1" />
    </>
  ),
  agreements: (
    <>
      <path d="M4 2.5h7l3 3v10H4z" />
      <path d="M6.5 8.5h5M6.5 11.5h5" />
    </>
  ),
  challans: (
    <>
      <path d="M2 5.5h9v7H2zM11 8h3l2 2.5v2h-5z" />
      <circle cx="5" cy="13.5" r="1.3" />
      <circle cx="13" cy="13.5" r="1.3" />
    </>
  ),
  bills: (
    <>
      <path d="M4 2.5h10v13l-2-1.3-1.7 1.3L8.6 14.2 7 15.5l-1.4-1.3L4 15.5z" />
      <path d="M6.5 6.5h5M6.5 9.5h3" />
    </>
  ),
  payments: (
    <>
      <rect x="2" y="4.5" width="14" height="9" rx="2" />
      <path d="M2 7.5h14" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="6" r="3" />
      <path d="M3 15.5c.7-3 3-4.8 6-4.8s5.3 1.8 6 4.8" />
    </>
  ),
  search: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="m11.8 11.8 3.7 3.7" />
    </>
  ),
  bell: (
    <>
      <path d="M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5H3z" />
      <path d="M7.5 15.5h3" />
    </>
  ),
  chat: <path d="M2.5 4h13v8h-7L5 14.8V12H2.5z" />,
  'chevron-down': <path d="m4 7 5 5 5-5" />,
  plus: <path d="M9 3.5v11M3.5 9h11" />,
  close: <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" />,
  menu: <path d="M3 5h12M3 9h12M3 13h12" />,
  'arrow-right': <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />,
  rupee: <path d="M5 3.5h8M5 6.5h8M7 3.5c3 0 4 1.7 4 3.2S10 9.9 7 9.9H5l5.5 5.1" />,
  settings: (
    <>
      <path d="M2.5 5.5h13M2.5 12.5h13" />
      <circle cx="6" cy="5.5" r="1.8" />
      <circle cx="12" cy="12.5" r="1.8" />
    </>
  ),
  logout: <path d="M7.5 3H4v12h3.5M11 6l3 3-3 3M14 9H7" />,
};

export function Icon({ name, size = 16, className }: IconProps) {
  if (name === 'brand') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 22 22"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
        className={className}
      >
        <path d="M4 2v18M18 2v18M4 7h14M4 15h14M4 7l14 8" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {GLYPHS[name]}
    </svg>
  );
}
