'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Service } from '../types/api';
import { FOCUS_SERVICE_KEY, SECTION_PATHS, type ConsoleSection } from '../lib/sections';

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  role: string;
  services: Service[];
};

const SECTION_IDS: Record<string, ConsoleSection> = {
  overview: 'overview',
  'services-list': 'services',
  'deployments-list': 'deployments',
  'health-list': 'health',
  'access-list': 'access',
  'alerts-list': 'alerts',
  admin: 'admin',
};

export default function CommandPalette({ open, onClose, role, services }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = role === 'SUPER_ADMIN';

  const commands = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [
      { id: 'overview', label: 'Go to Overview', hint: 'Overview dashboard', icon: '◫' },
      { id: 'services-list', label: 'Go to Services', hint: 'Service registry', icon: '▣' },
      { id: 'deployments-list', label: 'Go to Deployments', hint: 'Deployment history', icon: '⌁' },
    ];
    if (!isAdmin) {
      navItems.push({ id: 'health-list', label: 'Go to Webhook Health', hint: 'Health checks', icon: '⌁' });
      navItems.push({ id: 'access-list', label: 'Go to Access Credentials', hint: 'Credential vault', icon: '♢' });
      navItems.push({ id: 'alerts-list', label: 'Go to Alerts', hint: 'Session alerts', icon: '!' });
    } else {
      navItems.push({ id: 'admin', label: 'Go to Administration', hint: 'Clients, agents & services', icon: '◉' });
    }
    const serviceItems: PaletteItem[] = services.map((service) => ({
      id: `service-${service.id}`,
      label: `Open ${service.name}`,
      hint: `${service.type === 'PM2' ? 'PM2' : 'Static'} · ${service.enabled ? 'enabled' : 'disabled'}`,
      icon: service.type === 'PM2' ? '▣' : '▤',
    }));
    return [...navItems, ...serviceItems];
  }, [isAdmin, services]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((item) =>
      `${item.label} ${item.hint}`.toLowerCase().includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [query, open]);

  if (!open) return null;

  function run(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    if (item.id.startsWith('service-')) {
      window.sessionStorage.setItem(FOCUS_SERVICE_KEY, item.id.slice('service-'.length));
      router.push(SECTION_PATHS.services);
      return;
    }
    const section = SECTION_IDS[item.id];
    if (section) router.push(SECTION_PATHS[section]);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(filtered[activeIndex]);
    }
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="command-palette__input-row">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="command-palette__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={isAdmin ? 'Search pages, services, or admin actions…' : 'Search pages, services, or credentials…'}
            aria-label="Search commands"
          />
          <kbd className="command-palette__kbd">ESC</kbd>
        </div>
        <ul className="command-palette__list" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <li className="command-palette__empty">No matching commands.</li>
          ) : (
            filtered.slice(0, 40).map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`command-palette__item${index === activeIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => run(item)}
                >
                  <span className="command-palette__icon" aria-hidden="true">{item.icon}</span>
                  <span className="command-palette__label">{item.label}</span>
                  <span className="command-palette__hint">{item.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}