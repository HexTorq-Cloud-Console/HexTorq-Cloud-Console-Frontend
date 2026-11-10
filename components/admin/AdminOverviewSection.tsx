'use client';

import type { Agent, Client, ClientAccess, Service } from '../../types/api';

export default function AdminOverviewSection({
  clients,
  agents,
  services,
  accessEntries,
  onCreateClient,
  onCreateAgent,
  onCreateService,
  onCreateAccess,
  onOpenSettings,
}: {
  clients: Client[];
  agents: Agent[];
  services: Service[];
  accessEntries: ClientAccess[];
  onCreateClient: () => void;
  onCreateAgent: () => void;
  onCreateService: () => void;
  onCreateAccess: () => void;
  onOpenSettings: () => void;
}) {
  const enabledServices = services.filter((service) => service.enabled).length;
  const onlineAgents = agents.filter((agent) => agent.status === 'online').length;
  const enabledClients = clients.filter((client) => client.enabled).length;

  const summary = [
    { icon: '◉', tone: '', value: clients.length, label: 'Active clients', note: `${enabledClients} enabled` },
    { icon: '▣', tone: 'admin-metric__icon--blue', value: agents.length, label: 'VPS agents', note: `${onlineAgents} online` },
    { icon: '⬡', tone: 'admin-metric__icon--purple', value: services.length, label: 'Managed services', note: `${enabledServices} enabled` },
    { icon: '⌁', tone: 'admin-metric__icon--amber', value: accessEntries.length, label: 'Access credentials', note: `${accessEntries.filter((entry) => entry.enabled).length} enabled` },
  ];

  return (
    <>
      <div className="admin-metrics" aria-label="Administration summary">
        {summary.map((metric) => (
          <div className="admin-metric" key={metric.label}>
            <span className={`admin-metric__icon ${metric.tone}`}>{metric.icon}</span>
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <small>{metric.note}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-lists">
        <div className="active-list admin-quickstart">
          <div className="list-heading">
            <div>
              <span className="list-kicker">GETTING STARTED</span>
              <h3>Quick actions</h3>
            </div>
          </div>
          <div className="admin-quickstart__grid">
            <button onClick={onCreateClient}>
              <strong>Add a client</strong>
              <span>Issue a secure temporary login and hand over a dashboard.</span>
            </button>
            <button onClick={onCreateAgent}>
              <strong>Register a VPS agent</strong>
              <span>Connect a server so it can run deployments and report status.</span>
            </button>
            <button onClick={onCreateService}>
              <strong>Register a service</strong>
              <span>Point a repository at a client and a VPS, and pick its branch.</span>
            </button>
            <button onClick={onCreateAccess}>
              <strong>Share credentials</strong>
              <span>Give a client encrypted SFTP or database access.</span>
            </button>
            <button className="secondary" onClick={onOpenSettings}>
              <strong>Console settings</strong>
              <span>Control how long deployment logs are retained.</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
