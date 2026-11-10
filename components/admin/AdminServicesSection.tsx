'use client';

import type { Service } from '../../types/api';

export default function AdminServicesSection({
  services,
  onCreate,
  onEdit,
  onDelete,
}: {
  services: Service[];
  onCreate: () => void;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
}) {
  const enabled = services.filter((service) => service.enabled).length;

  return (
    <div className="active-list admin-services" id="admin-services">
      <div className="list-heading">
        <div>
          <span className="list-kicker">DEPLOYMENTS</span>
          <h3>Services</h3>
        </div>
        <span className="list-count">{services.length}</span>
      </div>
      <p className="muted admin-section__intro">
        {enabled} of {services.length} pipelines are enabled. A blank branch deploys the repository default
        branch; naming a branch deploys that branch exactly.
      </p>
      {services.length === 0 ? (
        <p className="muted">No services registered.</p>
      ) : (
        services.map((service) => (
          <div className="active-row" key={service.id}>
            <div className={`status-dot ${service.enabled ? 'online' : ''}`} />
            <div>
              <strong>{service.name}</strong>
              <small>
                {service.client?.name || 'No client'} / {service.agent?.name || 'No agent'} /{' '}
                {service.type.replace('_', ' ')} / {service.branch || 'origin/HEAD'}
              </small>
            </div>
            <span className="row-meta">{service.enabled ? 'Enabled' : 'Disabled'}</span>
            <div className="row-actions">
              <button onClick={() => onEdit(service)}>Edit</button>
              <button onClick={() => onDelete(service)}>Delete</button>
            </div>
          </div>
        ))
      )}
      <div className="admin-section__footer">
        <button onClick={onCreate}>+ Service</button>
      </div>
    </div>
  );
}
