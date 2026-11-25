import type { ReactNode, SVGProps } from 'react';

export type PremiumIconName =
  | 'process' | 'static' | 'terminal' | 'refresh' | 'logs' | 'registry'
  | 'search' | 'rocket' | 'bolt' | 'overview' | 'deployments' | 'health'
  | 'access' | 'alerts' | 'clients' | 'agents' | 'settings' | 'check' | 'warning';

const paths: Record<PremiumIconName, ReactNode> = {
  process: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h.01M10 8h.01M7 12h10M7 16h6" /></>,
  static: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 5.5v15M8 7h8M8 11h7" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></>,
  logs: <><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
  registry: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  rocket: <><path d="M14 4c2.5-1.3 5.1-1.2 6-.2.9.9 1 3.5-.2 6-1.1 2.4-3.5 4.8-6 6.2l-4.1-4.1C11.1 9.4 11.6 6.4 14 4Z" /><path d="m9.7 11.9-4.8.7-2 2 4.8.7.7 4.8 2-2 .7-4.8M15.5 8.5h.01" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  deployments: <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1Z" /><path d="m12 15-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2Z" /></>,
  health: <path d="M3 12h4l2.5 7 4-14 2.5 7h5" />,
  access: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 7-7 3 3-3 3M16 8l2 2" /></>,
  alerts: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  clients: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8" /></>,
  agents: <><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  warning: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
};

export default function PremiumIcon({ name, size = 16, ...props }: { name: PremiumIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
