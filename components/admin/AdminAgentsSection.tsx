'use client';

import type { Agent, Service } from '../../types/api';

export default function AdminAgentsSection({
  agents,
  services,
  onCreate,
  onRegenerateToken,
}: {
  agents: Agent[];
  services: Service[];
  onCreate: () => void;
  onRegenerateToken: (agentId: string) => void;
}) {
  const serviceCount = (agentId: string) => services.filter((service) => service.agent?.id === agentId).length;

  return (
    <div className="active-list" id="admin-agents">
      <div className="list-heading">
        <div>
          <span className="list-kicker">INFRASTRUCTURE</span>
          <h3>VPS agents</h3>
        </div>
        <span className="list-count">{agents.length}</span>
      </div>
      <p className="muted admin-section__intro">
        Agents run on each VPS and connect this console to the pipeline. An agent is online once it has
        reported a heartbeat.
      </p>
      {agents.length === 0 ? (
        <p className="muted">No agents registered.</p>
      ) : (
        agents.map((agent) => (
          <div className="active-row" key={agent.id}>
            <div className={`status-dot ${agent.status === 'online' ? 'online' : agent.status === 'disabled' ? 'disabled' : ''}`} />
            <div>
              <strong>{agent.name}</strong>
              <small>{agent.baseUrl}</small>
              <small className="agent-id">Agent ID: {agent.id}</small>
              {agent.lastSeenAt && <small className="agent-seen">Last seen: {new Date(agent.lastSeenAt).toLocaleString()}</small>}
            </div>
            <div className="row-meta">
              <span className="admin-agent-status" data-status={agent.status || 'unknown'}>{agent.status || 'unknown'}</span>
              <span className="admin-agent-services">{serviceCount(agent.id)} service{serviceCount(agent.id) === 1 ? '' : 's'}</span>
            </div>
            <button className="secondary row-action" onClick={() => onRegenerateToken(agent.id)}>
              New token
            </button>
          </div>
        ))
      )}
      <div className="admin-section__footer">
        <button onClick={onCreate}>+ VPS agent</button>
      </div>
    </div>
  );
}
