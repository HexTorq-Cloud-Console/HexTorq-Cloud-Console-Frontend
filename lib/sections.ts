export type ConsoleSection =
  | 'overview'
  | 'services'
  | 'deployments'
  | 'health'
  | 'access'
  | 'alerts'
  | 'admin'
  | 'admin-clients'
  | 'admin-agents'
  | 'admin-resources'
  | 'admin-services'
  | 'admin-access'
  | 'admin-audit-logs'
  | 'admin-notifications'
  | 'admin-settings';

export const SECTION_PATHS: Record<ConsoleSection, string> = {
  overview: '/overview',
  services: '/services',
  deployments: '/deployments',
  health: '/health',
  access: '/access',
  alerts: '/alerts',
  admin: '/admin',
  'admin-clients': '/admin/clients',
  'admin-agents': '/admin/agents',
  'admin-resources': '/admin/resources',
  'admin-services': '/admin/services',
  'admin-access': '/admin/access',
  'admin-audit-logs': '/admin/audit-logs',
  'admin-notifications': '/admin/notifications',
  'admin-settings': '/admin/settings',
};

// Legacy hash links are kept so bookmarks from the old single-page admin
// panel still land on the matching section.
const LEGACY_HASHES: Record<string, ConsoleSection> = {
  '#overview': 'overview',
  '#services': 'services',
  '#services-list': 'services',
  '#deployments': 'deployments',
  '#deployments-list': 'deployments',
  '#health': 'health',
  '#health-list': 'health',
  '#access': 'access',
  '#access-list': 'access',
  '#alerts': 'alerts',
  '#alerts-list': 'alerts',
  '#admin': 'admin',
  '#admin-clients': 'admin-clients',
  '#admin-agents': 'admin-agents',
  '#admin-resources': 'admin-resources',
  '#admin-services': 'admin-services',
  '#admin-access': 'admin-access',
  '#admin-audit-logs': 'admin-audit-logs',
  '#admin-notifications': 'admin-notifications',
  '#admin-settings': 'admin-settings',
};

export function sectionFromLegacyHash(hash: string): ConsoleSection | null {
  return LEGACY_HASHES[hash] ?? null;
}

export const FOCUS_SERVICE_KEY = 'hextorq_focus_service';
export const FAILURE_ALERTS_KEY = 'hextorq_failure_alerts';

export function isClientOnlySection(section: ConsoleSection) {
  return section === 'health' || section === 'access' || section === 'alerts';
}

/** Every administration page is restricted to the super-admin role. */
export function isAdminSection(section: ConsoleSection) {
  return section === 'admin' || section.startsWith('admin-');
}
