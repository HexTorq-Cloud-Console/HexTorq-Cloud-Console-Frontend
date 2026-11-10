// Shared API types for the console.
export type ServiceType = 'PM2' | 'STATIC_FRONTEND';

export type AgentStatus = 'online' | 'offline' | 'disabled' | 'unknown';

export type Service = {
  id: string;
  name: string;
  slug: string;
  type: ServiceType;
  repositoryUrl: string;
  branch: string | null;
  projectKey: string;
  webhookUrl?: string | null;
  workingDirectory: string;
  deployDirectory?: string | null;
  pm2ProcessName?: string | null;
  templateKey?: string | null;
  customCommands?: Record<string, string> | null;
  enabled: boolean;
  client: { id: string; name: string; email: string };
  agent: { id: string; name: string; baseUrl: string; enabled: boolean; lastSeenAt?: string | null; status?: AgentStatus };
};

export type Deployment = {
  id: string;
  runId: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  service: { id: string; name: string };
  commitHash?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
  failureReason?: string | null;
};

export type DeploymentLog = { timestamp: string; message: string };

export type DeploymentPage = {
  deployments: Deployment[];
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
};

export type DailyDeploymentBucket = {
  date: string;
  total: number;
  successful: number;
  failed: number;
  running: number;
};

export type AnalyticsData = {
  window: { from: string; to: string; days: number };
  summary: { total: number; successful: number; failed: number; running: number; successRate: number | null };
  daily: DailyDeploymentBucket[];
  services: { total: number; enabled: number; disabled: number; pm2: number; static: number };
};

export type Pm2Status = { status?: string; cpu?: number; memory?: number; restarts?: number };

export type WebhookHealthService = {
  id: string;
  name: string;
  slug: string;
  type: ServiceType;
  pm2ProcessName?: string | null;
  enabled: boolean;
};

export type WebhookDeployment = {
  id: string;
  runId: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  failureReason?: string | null;
};

export type WebhookHealthCheck = {
  id: string;
  serviceId: string;
  service: WebhookHealthService;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  httpStatus?: number | null;
  message?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  deployment?: WebhookDeployment | null;
};

export type WebhookHealthRun = {
  id: string;
  clientId?: string;
  source: 'MANUAL' | 'SCHEDULED';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  requestedBy?: string | null;
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  startedAt: string;
  completedAt?: string | null;
  checks: WebhookHealthCheck[];
};

export type WebhookSchedule = {
  clientId: string;
  enabled: boolean;
  intervalDays: number | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  timeZone: string;
  hour: number;
};

export type WebhookRunSummary = {
  id: string;
  source: 'MANUAL' | 'SCHEDULED';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  startedAt: string;
  completedAt?: string | null;
};

export type WebhookHealthData = {
  schedule: WebhookSchedule;
  latestRun?: WebhookHealthRun | null;
  activeRun?: WebhookHealthRun | null;
  recentRuns: WebhookRunSummary[];
};

export type FailureAlert = {
  id: string;
  title: string;
  timestamp: string;
  details: string;
};

export type AccessType = 'SFTP' | 'DATABASE';
export type ClientAccess = {
  id: string;
  clientId: string;
  type: AccessType;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string | null;
  path?: string | null;
  databaseName?: string | null;
  sslMode?: string | null;
  notes?: string | null;
  enabled: boolean;
  client?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
};
export type AccessForm = {
  clientId: string;
  type: AccessType;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  databaseName: string;
  sslMode: string;
  notes: string;
  enabled: boolean;
};
export type Client = { id: string; name: string; email: string; _count: { services: number; accessEntries: number } };
export type ClientNotificationStatus = {
  clientId: string;
  name: string;
  email: string;
  enabled: boolean;
  pushDevices: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  emailAddress: string | null;
  notifyStarted: boolean;
  notifyCompleted: boolean;
  notifyFailed: boolean;
};
export type Agent = { id: string; name: string; baseUrl: string; enabled: boolean; lastSeenAt?: string | null; status?: AgentStatus };
export type Pm2Process = { name: string; id: number; status?: string };
export type Template = { key: string; name: string; type: ServiceType };
export type ServiceForm = {
  name: string;
  slug: string;
  type: ServiceType;
  repositoryUrl: string;
  branch: string;
  projectKey: string;
  webhookUrl: string;
  workingDirectory: string;
  deployDirectory: string;
  pm2ProcessName: string;
  templateKey: string;
  clientId: string;
  agentId: string;
};
export type ServiceEditForm = {
  name: string;
  branch: string;
  enabled: boolean;
  templateKey: string;
  pm2ProcessName: string;
  deployDirectory: string;
};
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

export type Pm2LogEntry = { message: string; stream?: string; timestamp?: string; live?: boolean; error?: boolean };
