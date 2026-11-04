export type ConsoleSection =
  | 'overview'
  | 'services'
  | 'deployments'
  | 'health'
  | 'access'
  | 'alerts'
  | 'admin';

export const SECTION_PATHS: Record<ConsoleSection, string> = {
  overview: '/overview',
  services: '/services',
  deployments: '/deployments',
  health: '/health',
  access: '/access',
  alerts: '/alerts',
  admin: '/admin',
};

const LEGACY_HASHES: Record<string, ConsoleSection> = {
  '#overview': 'overview',
  '#services-list': 'services',
  '#deployments-list': 'deployments',
  '#health-list': 'health',
  '#access-list': 'access',
  '#alerts-list': 'alerts',
  '#admin': 'admin',
  '#admin-clients': 'admin',
  '#admin-agents': 'admin',
  '#admin-services': 'admin',
  '#admin-access': 'admin',
};

export function sectionFromLegacyHash(hash: string): ConsoleSection | null {
  return LEGACY_HASHES[hash] ?? null;
}

export const FOCUS_SERVICE_KEY = 'hextorq_focus_service';
export const FAILURE_ALERTS_KEY = 'hextorq_failure_alerts';

export function isClientOnlySection(section: ConsoleSection) {
  return section === 'health' || section === 'access' || section === 'alerts';
}
