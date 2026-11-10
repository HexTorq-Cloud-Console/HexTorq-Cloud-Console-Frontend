'use client';

import type { ClientAccess } from '../../types/api';

export default function AdminAccessSection({
  accessEntries,
  error,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  accessEntries: ClientAccess[];
  error: string;
  onCreate: () => void;
  onView: (access: ClientAccess) => void;
  onEdit: (access: ClientAccess) => void;
  onDelete: (access: ClientAccess) => void;
}) {
  return (
    <div className="active-list admin-access" id="admin-access">
      <div className="list-heading">
        <div>
          <span className="list-kicker">CLIENT ACCESS</span>
          <h3>FileZilla & database credentials</h3>
        </div>
        <span className="list-count">{accessEntries.length}</span>
      </div>
      <p className="muted admin-section__intro">
        Encrypted at rest and revealed on demand. Clients only ever see the entries assigned to their account.
      </p>
      {error && <p className="error">{error}</p>}
      {accessEntries.length === 0 ? (
        <p className="muted">No client access credentials have been created.</p>
      ) : (
        accessEntries.map((access) => (
          <div className="active-row" key={access.id}>
            <span className={`access-type-badge ${access.type === 'DATABASE' ? 'database' : 'sftp'}`}>
              {access.type === 'DATABASE' ? 'DB' : 'SFTP'}
            </span>
            <div>
              <strong>{access.label}</strong>
              <small>
                {access.client?.name || 'Unknown client'} / {access.host}:{access.port} / {access.username}
              </small>
            </div>
            <span className="row-meta">{access.enabled ? 'Enabled' : 'Disabled'}</span>
            <div className="row-actions">
              <button onClick={() => onView(access)}>View</button>
              <button onClick={() => onEdit(access)}>Edit</button>
              <button onClick={() => onDelete(access)}>Delete</button>
            </div>
          </div>
        ))
      )}
      <div className="admin-section__footer">
        <button onClick={onCreate}>+ Access</button>
      </div>
    </div>
  );
}
