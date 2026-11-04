import type {
  AnalyticsData,
  ClientAccess,
  Deployment,
  Pm2Status,
  Service,
  WebhookHealthData,
} from '../types/api';

export type ConsoleCache = {
  token: string;
  services: Service[];
  deployments: Deployment[];
  analytics: AnalyticsData | null;
  deploymentHasMore: boolean;
  deploymentNextCursor: string | null;
  accessEntries: ClientAccess[];
  health: WebhookHealthData | null;
  pm2Status: Record<string, Pm2Status>;
  pm2FetchedAt: Record<string, string>;
};

let cache: ConsoleCache | null = null;

export function readConsoleCache(token: string) {
  return cache && cache.token === token ? cache : null;
}

export function writeConsoleCache(next: ConsoleCache) {
  cache = next;
}

export function clearConsoleCache() {
  cache = null;
}
