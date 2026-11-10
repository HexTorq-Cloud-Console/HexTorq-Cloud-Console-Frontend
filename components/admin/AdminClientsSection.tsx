'use client';

import type { Client } from '../../types/api';

export default function AdminClientsSection({
  clients,
  onCreate,
}: {
  clients: Client[];
  onCreate: () => void;
}) {
  return (
    <div className="active-list" id="admin-clients">
      <div className="list-heading">
        <div>
          <span className="list-kicker">ACCOUNTS</span>
          <h3>Clients</h3>
        </div>
        <span className="list-count">{clients.length}</span>
      </div>
      <p className="muted admin-section__intro">
        Every client gets a secure login and can only see the services and credentials assigned to them.
      </p>
      {clients.length === 0 ? (
        <p className="muted">No clients yet.</p>
      ) : (
        clients.map((client) => (
          <div className="active-row" key={client.id}>
            <div className="avatar">{client.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{client.name}</strong>
              <small>{client.email}</small>
            </div>
            <span className="row-meta">
              {client._count.services} services / {client._count.accessEntries ?? 0} access
            </span>
          </div>
        ))
      )}
      <div className="admin-section__footer">
        <button onClick={onCreate}>+ Client</button>
      </div>
    </div>
  );
}
