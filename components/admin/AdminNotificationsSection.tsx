'use client';

import NotificationSettings from '../NotificationSettings';
import type { ClientNotificationStatus } from '../../types/api';

export default function AdminNotificationsSection({
  clients,
}: {
  clients: ClientNotificationStatus[];
}) {
  return (
    <div className="active-list admin-notifications" id="admin-notifications">
      <div className="list-heading">
        <div>
          <span className="list-kicker">DEPLOYMENT NOTIFICATIONS</span>
          <h3>Browser push & email alerts</h3>
        </div>
        <span className="list-count">{clients.length}</span>
      </div>
      <p className="muted admin-section__intro">
        Configure notifications for this console account, and check which clients have alerts enabled.
        Every client controls their own devices and channels on their Alerts page.
      </p>

      <NotificationSettings />

      {clients.length === 0 ? (
        <p className="muted">No client notification settings have been configured yet.</p>
      ) : (
        <div className="notify-admin-table" role="table" aria-label="Client notification status">
          <div className="notify-admin-row notify-admin-row--head" role="row">
            <span role="columnheader">Client</span>
            <span role="columnheader">Push devices</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Notify on</span>
          </div>
          {clients.map((entry) => (
            <div className="notify-admin-row" role="row" key={entry.clientId}>
              <span role="cell">
                <strong>{entry.name}</strong>
                <small>{entry.email}</small>
              </span>
              <span role="cell">
                {entry.pushEnabled ? (
                  entry.pushDevices > 0
                    ? <span className="notify-admin-ok">{entry.pushDevices} device(s)</span>
                    : <span className="notify-admin-warn">Enabled, no device</span>
                ) : (
                  <span className="notify-admin-off">Off</span>
                )}
              </span>
              <span role="cell">
                {entry.emailEnabled && entry.emailAddress ? (
                  <span className="notify-admin-ok">{entry.emailAddress}</span>
                ) : (
                  <span className="notify-admin-off">Off</span>
                )}
              </span>
              <span role="cell">
                {[
                  entry.notifyStarted ? 'Start' : null,
                  entry.notifyCompleted ? 'Success' : null,
                  entry.notifyFailed ? 'Failure' : null,
                ].filter(Boolean).join(' · ') || <span className="notify-admin-off">Nothing</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
