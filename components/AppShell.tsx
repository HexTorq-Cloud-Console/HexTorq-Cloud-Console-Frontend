'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

type IconName =
  | 'overview'
  | 'services'
  | 'deployments'
  | 'health'
  | 'access'
  | 'alerts'
  | 'admin'
  | 'clients'
  | 'agents'
  | 'shield';

type NavItem = { id: string; label: string; icon: IconName; href: string; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

type AppShellProps = {
  role: string;
  email?: string;
  alertCount?: number;
  onSignOut: () => void;
  onOpenPalette?: () => void;
  children: ReactNode;
};

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'overview':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'services':
      return (
        <svg {...common}>
          <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      );
    case 'deployments':
      return (
        <svg {...common}>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0Z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );
    case 'health':
      return (
        <svg {...common}>
          <path d="M3 12h4l2.5 7 4-14 2.5 7h5" />
        </svg>
      );
    case 'access':
      return (
        <svg {...common}>
          <path d="m15.5 7.5 3 3L21 8l-3-3" />
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="m11 12 4-4" />
        </svg>
      );
    case 'alerts':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'agents':
      return (
        <svg {...common}>
          <rect x="2" y="3" width="20" height="8" rx="2" />
          <rect x="2" y="13" width="20" height="8" rx="2" />
          <path d="M6 7h.01M6 17h.01" />
        </svg>
      );
    case 'shield':
    default:
      return (
        <svg {...common}>
          <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
        </svg>
      );
  }
}

function initialsFrom(email?: string) {
  if (!email) return 'HT';
  const local = email.split('@')[0] || '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || parts[0]?.[1] || '';
  const value = (first + second).toUpperCase();
  return value || 'HT';
}

const CLIENT_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: 'overview', href: '/overview' },
      { id: 'services', label: 'Services', icon: 'services', href: '/services' },
      { id: 'deployments', label: 'Deployments', icon: 'deployments', href: '/deployments' },
      { id: 'health', label: 'Webhook Health', icon: 'health', href: '/health' },
      { id: 'access', label: 'Access Credentials', icon: 'access', href: '/access' },
    ],
  },
];

export default function AppShell({ role, email, alertCount = 0, onSignOut, onOpenPalette, children }: AppShellProps) {
  const isAdmin = role === 'SUPER_ADMIN';
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const groups: NavGroup[] = isAdmin
    ? [
        {
          label: 'Workspace',
          items: [
            { id: 'overview', label: 'Overview', icon: 'overview', href: '/overview' },
            { id: 'services', label: 'Services', icon: 'services', href: '/services' },
            { id: 'deployments', label: 'Deployments', icon: 'deployments', href: '/deployments' },
          ],
        },
        {
          label: 'Administration',
          items: [
            { id: 'admin', label: 'Admin Overview', icon: 'admin', href: '/admin' },
            { id: 'admin-clients', label: 'Clients', icon: 'clients', href: '/admin/clients' },
            { id: 'admin-agents', label: 'VPS Agents', icon: 'agents', href: '/admin/agents' },
            { id: 'admin-services', label: 'All Services', icon: 'services', href: '/admin/services' },
            { id: 'admin-access', label: 'Access Management', icon: 'access', href: '/admin/access' },
            { id: 'admin-notifications', label: 'Notifications', icon: 'alerts', href: '/admin/notifications' },
          ],
        },
      ]
    : [
        {
          label: 'Workspace',
          items: [...CLIENT_GROUPS[0].items, { id: 'alerts', label: 'Alerts', icon: 'alerts', href: '/alerts', badge: alertCount }],
        },
      ];

  function isActive(item: NavItem) {
    // Every navigation target is now a distinct route, so the active item is
    // the one whose path matches the current pathname exactly.
    const [path] = item.href.split('#');
    return path === pathname;
  }

  const activeItem = groups.flatMap((group) => group.items).find(isActive);
  const activeLabel = activeItem?.label || (isAdmin ? 'Admin Overview' : 'Overview');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? 'hidden' : previous;
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  // The collapsed rail only exists on desktop. When the viewport turns into the drawer
  // layout the rail state is cleared, so the sidebar can never end up collapsed with no
  // control left to expand it.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    };
    setIsMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((current) => !current);
      // The desktop rail state must never survive into the drawer layout, otherwise
      // the sidebar can end up collapsed with no visible control to expand it again.
      setCollapsed(false);
    } else {
      setCollapsed((current) => !current);
    }
  }

  const roleLabel = isAdmin ? 'Super Admin' : 'Client';

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`}>
      <aside className="shell-sidebar" aria-label="Primary navigation">
        <div className="shell-brand">
          <span className="shell-brand__mark" aria-hidden="true">
            H
          </span>
          <span className="shell-brand__text">
            <Logo size="sm" />
          </span>
        </div>

        <nav className="shell-nav">
          {groups.map((group) => (
            <div className="shell-group" key={group.label}>
              <p className="shell-group__label">
                {group.label}
                {group.label === 'Administration' && <span className="shell-group__chip">Admin</span>}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`shell-link${isActive(item) ? ' is-active' : ''}`}
                      aria-current={isActive(item) ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="shell-link__icon">
                        <Icon name={item.icon} />
                      </span>
                      <span className="shell-link__label">{item.label}</span>
                      {item.badge ? <span className="shell-link__badge">{item.badge}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shell-user">
          <span className="shell-avatar">{initialsFrom(email)}</span>
          <div className="shell-user__meta">
            <strong title={email}>{email || 'Signed in'}</strong>
            <span>{roleLabel}</span>
          </div>
          <button type="button" className="shell-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="shell-scrim"
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <div className="shell-body">
        <header className="shell-topbar">
          <button type="button" className="shell-menu" onClick={toggleSidebar} aria-label={isMobile ? 'Toggle navigation' : 'Collapse sidebar'} aria-expanded={isMobile ? mobileOpen : !collapsed}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <nav className="shell-crumbs" aria-label="Breadcrumb">
            <span>{isAdmin ? 'Admin Console' : 'Client Console'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
            <strong>{activeLabel}</strong>
          </nav>

          <button type="button" className="shell-search" onClick={onOpenPalette} aria-label="Search anything">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <span className="shell-search__text">Search anything...</span>
          </button>

          <div className="shell-top-actions">
            <ThemeToggle />
          </div>
        </header>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
