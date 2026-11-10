'use client';

import { FormEvent, useEffect, useState } from 'react';
import AccessEntryCard from './AccessEntryCard';
import Modal from './Modal';
import AdminAccessSection from './admin/AdminAccessSection';
import AdminAgentsSection from './admin/AdminAgentsSection';
import AdminClientsSection from './admin/AdminClientsSection';
import AdminNotificationsSection from './admin/AdminNotificationsSection';
import AdminOverviewSection from './admin/AdminOverviewSection';
import AdminServicesSection from './admin/AdminServicesSection';
import { apiUrl, errorMessage, responseJson } from '../lib/api';
import { liveRepositorySlug, serviceWebhookUrl, toSlug } from '../lib/format';
import { emptyAccessForm } from '../lib/forms';
import type { ConsoleSection } from '../lib/sections';
import type {
  AccessForm,
  AccessType,
  Agent,
  Client,
  ClientAccess,
  ClientNotificationStatus,
  Pm2Process,
  Service,
  ServiceEditForm,
  ServiceForm,
  ServiceType,
  Template,
} from '../types/api';

const ADMIN_SECTION_TITLES: Partial<Record<ConsoleSection, { title: string; subtitle: string }>> = {
  admin: { title: 'Administration', subtitle: 'Manage your active clients, agents, and services from one place.' },
  'admin-clients': { title: 'Clients', subtitle: 'Accounts that sign in to this console and see their own services.' },
  'admin-agents': { title: 'VPS agents', subtitle: 'Servers connected to the control plane that run your deployments.' },
  'admin-services': { title: 'Services', subtitle: 'Repositories, branches, and pipelines assigned to a client and an agent.' },
  'admin-access': { title: 'Access management', subtitle: 'Encrypted SFTP and database credentials shared with clients.' },
  'admin-notifications': { title: 'Notifications', subtitle: 'Browser push and email alerts for deployment activity.' },
};

function AdminPanel({ token, section, onChanged }: { token: string; section: ConsoleSection; onChanged?: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState('');
  const [pendingSecret, setPendingSecret] = useState<{ title: string; value: string; note?: string } | null>(null);
  const [pm2Processes, setPm2Processes] = useState<Pm2Process[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accessEntries, setAccessEntries] = useState<ClientAccess[]>([]);
  const [notificationClients, setNotificationClients] = useState<ClientNotificationStatus[]>([]);
  const [accessError, setAccessError] = useState('');
  const [accessForm, setAccessForm] = useState<AccessForm>(emptyAccessForm);
  const [editingAccess, setEditingAccess] = useState<ClientAccess | null>(null);
  const [viewingAccess, setViewingAccess] = useState<ClientAccess | null>(null);
  const [retention, setRetention] = useState(30);
  const [clientForm, setClientForm] = useState({ name: '', email: '', temporaryPassword: '' });
  const [agentForm, setAgentForm] = useState({ name: '', baseUrl: '' });
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    name: '',
    slug: '',
    type: 'PM2',
    repositoryUrl: '',
    branch: '',
     projectKey: '',
     webhookUrl: '',
     workingDirectory: '',
    deployDirectory: '',
    pm2ProcessName: '',
    templateKey: '',
    clientId: '',
    agentId: '',
  });
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceEdit, setServiceEdit] = useState<ServiceEditForm>({
    name: '',
    branch: '',
    enabled: true,
    templateKey: '',
    pm2ProcessName: '',
    deployDirectory: '',
  });
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'service' | 'access'; id: string; label: string } | null>(null);
  const [modal, setModal] = useState<'client' | 'agent' | 'service' | 'edit-service' | 'access' | 'edit-access' | 'view-access' | 'settings' | null>(null);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (clients.length || agents.length) {
      setServiceForm((current) => ({
        ...current,
        clientId: current.clientId || clients[0]?.id || '',
        agentId: current.agentId || agents[0]?.id || '',
      }));
    }
  }, [clients, agents]);

  useEffect(() => {
    const agent = agents.find((item) => item.id === serviceForm.agentId);
    const webhookUrl = serviceWebhookUrl(agent?.baseUrl || '', serviceForm.projectKey);
    setServiceForm((current) => current.webhookUrl === webhookUrl ? current : { ...current, webhookUrl });
  }, [agents, serviceForm.agentId, serviceForm.projectKey]);

  useEffect(() => {
    if (!serviceForm.agentId) {
      setPm2Processes([]);
      return;
    }
    let cancelled = false;
    fetch(`${apiUrl}/admin/agents/${encodeURIComponent(serviceForm.agentId)}/pm2/processes`, { headers })
      .then((response) => responseJson<{ processes?: Pm2Process[] }>(response))
      .then((data) => { if (!cancelled) setPm2Processes(data.processes || []); })
      .catch(() => { if (!cancelled) setPm2Processes([]); });
    return () => { cancelled = true; };
  }, [serviceForm.agentId, token]);

  async function loadRepositoryMetadata(repositoryUrl: string) {
    if (!repositoryUrl) return;
    try {
      const response = await fetch(`${apiUrl}/admin/repository-metadata?url=${encodeURIComponent(repositoryUrl)}`, { headers });
      const data = await responseJson<{ slug?: string; branch?: string }>(response);
      if (!response.ok) return;
       setServiceForm((current) => ({ ...current, slug: data.slug || current.slug }));
    } catch { /* Manual values remain usable if repository metadata is unavailable. */ }
  }

  async function refresh() {
    setAdminError('');
    try {
      const [clientResponse, agentResponse, templateResponse, settingsResponse, serviceResponse, accessResponse, notificationResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/clients`, { headers }),
        fetch(`${apiUrl}/admin/agents`, { headers }),
        fetch(`${apiUrl}/templates`, { headers }),
        fetch(`${apiUrl}/admin/settings`, { headers }),
        fetch(`${apiUrl}/services`, { headers }),
        fetch(`${apiUrl}/admin/access`, { headers }),
        fetch(`${apiUrl}/admin/notifications`, { headers }),
      ]);
      const clientData = await responseJson<{ clients?: Client[]; message?: string }>(clientResponse);
      const agentData = await responseJson<{ agents?: Agent[]; message?: string }>(agentResponse);
      const templateData = await responseJson<{ templates?: Template[]; message?: string }>(templateResponse);
      const settingsData = await responseJson<{ logRetentionDays?: number; message?: string }>(settingsResponse);
      const serviceData = await responseJson<{ services?: Service[]; message?: string }>(serviceResponse);
      const accessData = await responseJson<{ access?: ClientAccess[]; message?: string }>(accessResponse);
      const notificationData = await responseJson<{ clients?: ClientNotificationStatus[]; message?: string }>(notificationResponse);
      if (!clientResponse.ok) throw new Error(clientData.message || 'Unable to load clients');
      if (!agentResponse.ok) throw new Error(agentData.message || 'Unable to load agents');
      if (!templateResponse.ok) throw new Error(templateData.message || 'Unable to load templates');
      if (!settingsResponse.ok) throw new Error(settingsData.message || 'Unable to load settings');
      if (!serviceResponse.ok) throw new Error(serviceData.message || 'Unable to load services');
      setClients(clientData.clients || []);
      setAgents(agentData.agents || []);
      setTemplates(templateData.templates || []);
      setRetention(settingsData.logRetentionDays || 30);
      setServices(serviceData.services || []);
      setAccessEntries(accessResponse.ok ? accessData.access || [] : []);
      setAccessError(accessResponse.ok ? '' : accessData.message || 'Unable to load access credentials');
      setNotificationClients(notificationResponse.ok ? notificationData.clients || [] : []);
    } catch (reason) {
      setAdminError(errorMessage(reason, 'Unable to load administration data'));
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createClient(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clientForm),
      });
      const data = await responseJson<{ temporaryPassword?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to create client');
      setNotice(`Client ${clientForm.name || 'created'} created.`);
      if (data.temporaryPassword) setPendingSecret({ title: `Temporary password for ${clientForm.name || 'client'}`, value: data.temporaryPassword, note: 'Shown once. Share it privately and have the client set their own password on first sign-in.' });
      setClientForm({ name: '', email: '', temporaryPassword: '' });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create client'));
    }
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(agentForm),
      });
      const data = await responseJson<{ agent?: { id?: string }; enrollmentToken?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to register agent');
      setNotice(`Agent ${agentForm.name || 'registered'} registered.`);
      if (data.enrollmentToken) setPendingSecret({ title: `Enrollment token for ${agentForm.name || 'agent'}`, value: data.enrollmentToken, note: 'Shown once. Paste it into the pipeline agent environment to connect this VPS.' });
      setAgentForm({ name: '', baseUrl: '' });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to register agent'));
    }
  }

  async function regenerateAgentToken(agentId: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/agents/${agentId}/enrollment-token`, {
        method: 'POST',
        headers,
      });
      const data = await responseJson<{ enrollmentToken?: string; message?: string }>(response);
      if (!response.ok || !data.enrollmentToken) throw new Error(data.message || 'Unable to generate enrollment token');
      setNotice(`Enrollment token regenerated.`);
      setPendingSecret({ title: `New enrollment token for ${agents.find((agent) => agent.id === agentId)?.name || agentId}`, value: data.enrollmentToken, note: 'Shown once. This replaces the previous token; reconfigure the agent to use it.' });
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to generate enrollment token'));
    }
  }

  async function createService(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/services`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
         ...serviceForm,
            branch: serviceForm.branch.trim() || undefined,
           webhookUrl: serviceForm.webhookUrl || undefined,
           deployDirectory: serviceForm.type === 'STATIC_FRONTEND' ? serviceForm.deployDirectory : undefined,
          pm2ProcessName: serviceForm.type === 'PM2' ? serviceForm.pm2ProcessName : undefined,
        }),
      });
      const data = await responseJson<{ service?: Service; message?: string }>(response);
      if (!response.ok || !data.service) throw new Error(data.message || 'Unable to create service');
      setNotice(`Service ${data.service.name} created.`);
      setServiceForm({
        ...serviceForm,
        name: '',
        slug: '',
         repositoryUrl: '',
         webhookUrl: '',
         projectKey: '',
        workingDirectory: '',
        deployDirectory: '',
        pm2ProcessName: '',
      });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create service'));
    }
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceEdit({
      name: service.name,
      branch: service.branch || '',
      enabled: service.enabled,
      templateKey: service.templateKey || '',
      pm2ProcessName: service.pm2ProcessName || '',
      deployDirectory: service.deployDirectory || '',
    });
    setModal('edit-service');
  }

  function closeEditService() {
    setModal(null);
    setEditingService(null);
  }

  async function saveService(event: FormEvent) {
    event.preventDefault();
    if (!editingService) return;
    try {
      const payload: Record<string, unknown> = {
        name: serviceEdit.name,
        branch: serviceEdit.branch.trim() || null,
        enabled: serviceEdit.enabled,
        templateKey: serviceEdit.templateKey,
      };
      if (editingService.type === 'PM2') payload.pm2ProcessName = serviceEdit.pm2ProcessName;
      else payload.deployDirectory = serviceEdit.deployDirectory;

      const response = await fetch(`${apiUrl}/admin/services/${editingService.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await responseJson<{ service?: Service; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to update service');
      setNotice(`Service ${data.service?.name || serviceEdit.name} updated.`);
      closeEditService();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to update service'));
    }
  }

  async function deleteService(service: Service) {
    setDeleteTarget({ kind: 'service', id: service.id, label: service.name });
  }

  async function confirmDeleteService(service: Service) {
    try {
      const response = await fetch(`${apiUrl}/admin/services/${service.id}`, { method: 'DELETE', headers });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to delete service');
      setNotice(`Service ${service.name} deleted.`);
      if (editingService?.id === service.id) closeEditService();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to delete service'));
    }
  }

  function openCreateAccess() {
    setEditingAccess(null);
    setAccessForm(emptyAccessForm());
    setModal('access');
  }

  function changeAccessType(type: AccessType) {
    setAccessForm((current) => ({
      ...current,
      type,
      port: type === 'SFTP' ? 22 : 5432,
      sslMode: type === 'DATABASE' ? current.sslMode || 'Prefer' : '',
    }));
  }

  function buildAccessPayload() {
    const payload: Record<string, unknown> = {
      clientId: accessForm.clientId,
      type: accessForm.type,
      label: accessForm.label,
      host: accessForm.host,
      port: accessForm.port,
      username: accessForm.username,
      notes: accessForm.notes,
      enabled: accessForm.enabled,
    };
    if (accessForm.type === 'SFTP') {
      payload.path = accessForm.path;
    } else {
      payload.databaseName = accessForm.databaseName;
      payload.sslMode = accessForm.sslMode || 'Prefer';
    }
    return payload;
  }

  async function createAccess(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...buildAccessPayload(), password: accessForm.password }),
      });
      const data = await responseJson<{ access?: ClientAccess; message?: string }>(response);
      if (!response.ok || !data.access) throw new Error(data.message || 'Unable to create access credentials');
      setNotice(`Access ${data.access.label} created for ${data.access.client?.name || 'client'}.`);
      setModal(null);
      setAccessForm(emptyAccessForm());
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create access credentials'));
    }
  }

  function openEditAccess(access: ClientAccess) {
    setEditingAccess(access);
    setAccessForm({
      clientId: access.clientId,
      type: access.type,
      label: access.label,
      host: access.host,
      port: access.port,
      username: access.username,
      password: '',
      path: access.path || '',
      databaseName: access.databaseName || '',
      sslMode: access.sslMode || 'Prefer',
      notes: access.notes || '',
      enabled: access.enabled,
    });
    setModal('edit-access');
  }

  async function saveAccess(event: FormEvent) {
    event.preventDefault();
    if (!editingAccess) return;
    try {
      const payload = buildAccessPayload();
      delete payload.clientId;
      if (accessForm.password) payload.password = accessForm.password;
      const response = await fetch(`${apiUrl}/admin/access/${editingAccess.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await responseJson<{ access?: ClientAccess; message?: string }>(response);
      if (!response.ok || !data.access) throw new Error(data.message || 'Unable to update access credentials');
      setNotice(`Access ${data.access.label} updated.`);
      closeAccessModal();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to update access credentials'));
    }
  }

  function viewAccess(access: ClientAccess) {
    setViewingAccess(access);
    setModal('view-access');
  }

  function closeAccessModal() {
    setModal(null);
    setEditingAccess(null);
    setViewingAccess(null);
  }

  async function deleteAccess(access: ClientAccess) {
    setDeleteTarget({ kind: 'access', id: access.id, label: access.label });
  }

  async function revealAdminAccess(accessId: string) {
    const response = await fetch(`${apiUrl}/admin/access/${encodeURIComponent(accessId)}/reveal`, { headers });
    const data = await responseJson<{ password?: string | null; message?: string }>(response);
    if (!response.ok || data.password == null) throw new Error(data.message || 'Unable to reveal password');
    return data.password;
  }

  async function confirmDeleteAccess(access: ClientAccess) {
    try {
      const response = await fetch(`${apiUrl}/admin/access/${access.id}`, { method: 'DELETE', headers });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to delete access credentials');
      setNotice(`Access ${access.label} deleted.`);
      if (editingAccess?.id === access.id) closeAccessModal();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to delete access credentials'));
    }
  }

  function renderAccessFields(mode: 'create' | 'edit') {
    const isCreate = mode === 'create';
    return (
      <div className="form-columns">
        <label>
          Client
          <select
            value={accessForm.clientId}
            onChange={(event) => setAccessForm({ ...accessForm, clientId: event.target.value })}
            required={isCreate}
            disabled={!isCreate}
          >
            <option value="">Choose client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Access type
          <select value={accessForm.type} onChange={(event) => changeAccessType(event.target.value as AccessType)}>
            <option value="SFTP">FileZilla / SFTP</option>
            <option value="DATABASE">PostgreSQL database</option>
          </select>
        </label>
        <label>
          Label
          <input
            placeholder={accessForm.type === 'SFTP' ? 'FileZilla SFTP' : 'PostgreSQL read/write'}
            value={accessForm.label}
            onChange={(event) => setAccessForm({ ...accessForm, label: event.target.value })}
            required
          />
        </label>
        <label>
          Host
          <input placeholder="187.127.189.231" value={accessForm.host} onChange={(event) => setAccessForm({ ...accessForm, host: event.target.value })} required />
        </label>
        <label>
          Port
          <input
            type="number"
            min="1"
            max="65535"
            value={accessForm.port}
            onChange={(event) => setAccessForm({ ...accessForm, port: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          Username
          <input
            placeholder={accessForm.type === 'SFTP' ? 'rathinam_client' : 'rathinam_pgadmin'}
            value={accessForm.username}
            onChange={(event) => setAccessForm({ ...accessForm, username: event.target.value })}
            required
          />
        </label>
        <label>
          Password {!isCreate && <span>(leave blank to keep current)</span>}
          <input
            type="password"
            placeholder={isCreate ? 'Set a password' : 'Keep the current password'}
            value={accessForm.password}
            onChange={(event) => setAccessForm({ ...accessForm, password: event.target.value })}
            required={isCreate}
          />
        </label>
        {accessForm.type === 'SFTP' ? (
          <label>
            Path
            <input
              placeholder="/rathinam-projects/"
              value={accessForm.path}
              onChange={(event) => setAccessForm({ ...accessForm, path: event.target.value })}
              required
            />
          </label>
        ) : (
          <>
            <label>
              Maintenance database
              <input
                placeholder="nextup_db"
                value={accessForm.databaseName}
                onChange={(event) => setAccessForm({ ...accessForm, databaseName: event.target.value })}
                required
              />
            </label>
            <label>
              SSL mode
              <input
                placeholder="Prefer"
                value={accessForm.sslMode}
                onChange={(event) => setAccessForm({ ...accessForm, sslMode: event.target.value })}
              />
            </label>
          </>
        )}
        <label>
          Status
          <select
            value={accessForm.enabled ? 'true' : 'false'}
            onChange={(event) => setAccessForm({ ...accessForm, enabled: event.target.value === 'true' })}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label className="form-wide">
          Notes <span>(optional)</span>
          <textarea
            rows={3}
            placeholder="Read/write access to the client project folder."
            value={accessForm.notes}
            onChange={(event) => setAccessForm({ ...accessForm, notes: event.target.value })}
          />
        </label>
      </div>
    );
  }

  async function saveRetention(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ logRetentionDays: retention }),
      });
      const data = await responseJson<{ logRetentionDays?: number; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to save settings');
      setNotice(`Log retention set to ${data.logRetentionDays} days.`);
      setModal(null);
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to save settings'));
    }
  }

  return (
    <section className="admin-panel" id="admin">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h2>{ADMIN_SECTION_TITLES[section]?.title || 'Administration'}</h2>
          <p className="muted">{ADMIN_SECTION_TITLES[section]?.subtitle || 'Manage your active clients, agents, and services from one place.'}</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => setModal('client')}>+ Client</button>
          <button onClick={() => setModal('agent')}>+ VPS agent</button>
          <button onClick={() => setModal('service')}>+ Service</button>
          <button onClick={openCreateAccess}>+ Access</button>
          <button className="secondary" onClick={() => setModal('settings')}>
            Settings
          </button>
        </div>
      </div>
      {notice && <p className="message admin-notice">{notice}</p>}
      {adminLoading && <p className="muted admin-loading">Loading administration data…</p>}
      {adminError && (
        <div className="admin-error" role="alert">
          <span className="admin-error__icon" aria-hidden="true">!</span>
          <div><strong>Administration data could not be loaded</strong><p>{adminError}</p></div>
          <button className="ht-btn ht-btn--secondary" type="button" onClick={() => { setAdminLoading(true); void refresh(); }}>↻ Retry</button>
        </div>
      )}

      {section === 'admin' && (
        <AdminOverviewSection
          clients={clients}
          agents={agents}
          services={services}
          accessEntries={accessEntries}
          onCreateClient={() => setModal('client')}
          onCreateAgent={() => setModal('agent')}
          onCreateService={() => setModal('service')}
          onCreateAccess={openCreateAccess}
          onOpenSettings={() => setModal('settings')}
        />
      )}

      {section === 'admin-clients' && (
        <AdminClientsSection clients={clients} onCreate={() => setModal('client')} />
      )}

      {section === 'admin-agents' && (
        <AdminAgentsSection
          agents={agents}
          services={services}
          onCreate={() => setModal('agent')}
          onRegenerateToken={regenerateAgentToken}
        />
      )}

      {section === 'admin-services' && (
        <AdminServicesSection
          services={services}
          onCreate={() => setModal('service')}
          onEdit={openEditService}
          onDelete={deleteService}
        />
      )}

      {section === 'admin-access' && (
        <AdminAccessSection
          accessEntries={accessEntries}
          error={accessError}
          onCreate={openCreateAccess}
          onView={viewAccess}
          onEdit={openEditAccess}
          onDelete={deleteAccess}
        />
      )}

      {section === 'admin-notifications' && (
        <AdminNotificationsSection clients={notificationClients} />
      )}

      <Modal open={modal === 'client'} title="Create client" subtitle="Issue a secure temporary login for a new client." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createClient}>
          <label>
            Client name
            <input placeholder="Rathinam College" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} required />
          </label>
          <label>
            Email address
            <input placeholder="admin@client.com" type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} required />
          </label>
          <label>
            Temporary password <span>(optional)</span>
            <input placeholder="Auto-generate securely" value={clientForm.temporaryPassword} onChange={(event) => setClientForm({ ...clientForm, temporaryPassword: event.target.value })} />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Create client</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'agent'} title="Register VPS agent" subtitle="Connect a managed VPS to the HexTorq control plane." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createAgent}>
          <label>
            Agent name
            <input placeholder="Production VPS 01" value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} required />
          </label>
          <label>
            Agent base URL
            <input placeholder="https://agent.example.com" type="url" value={agentForm.baseUrl} onChange={(event) => setAgentForm({ ...agentForm, baseUrl: event.target.value })} required />
          </label>
          <p className="form-hint">The enrollment token will be shown once after creation.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Register agent</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'service'} title="Register service" subtitle="Assign a deployment service to a client and VPS agent." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createService}>
          <div className="form-columns">
            <label>
              Service name
              <input placeholder="CCTV Backend" value={serviceForm.name} onChange={(event) => {
                const name = event.target.value;
                setServiceForm((current) => ({ ...current, name, slug: current.repositoryUrl ? liveRepositorySlug(current.repositoryUrl) : toSlug(name) }));
              }} required />
            </label>
            <label>
              Slug
              <input placeholder="cctv-backend" value={serviceForm.slug} readOnly required />
            </label>
            <label>
              Service type
              <select value={serviceForm.type} onChange={(event) => setServiceForm({ ...serviceForm, type: event.target.value as ServiceType })}>
                <option value="PM2">PM2 backend</option>
                <option value="STATIC_FRONTEND">Static frontend</option>
              </select>
            </label>
            <label>
              Template
              <select value={serviceForm.templateKey} onChange={(event) => setServiceForm({ ...serviceForm, templateKey: event.target.value })}>
                <option value="">Custom commands</option>
                {templates
                  .filter((template) => template.type === serviceForm.type)
                  .map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Project key / webhook
              <input placeholder="Rathinam_CCTV_Backend" value={serviceForm.projectKey} onChange={(event) => setServiceForm({ ...serviceForm, projectKey: event.target.value })} required />
            </label>
            <label>
              Repository URL
              <input placeholder="https://github.com/..." type="url" value={serviceForm.repositoryUrl} onChange={(event) => {
                const repositoryUrl = event.target.value;
                setServiceForm((current) => ({ ...current, repositoryUrl, slug: liveRepositorySlug(repositoryUrl) || toSlug(current.name) }));
              }} onBlur={(event) => void loadRepositoryMetadata(event.target.value)} required />
            </label>
            <label>
              Full webhook URL
              <input placeholder="Select an agent and enter a project key" type="url" value={serviceForm.webhookUrl} readOnly required />
            </label>
            <label>
              Working directory
              <input placeholder="/home/mohan/SERVER/app" value={serviceForm.workingDirectory} onChange={(event) => setServiceForm({ ...serviceForm, workingDirectory: event.target.value })} required />
            </label>
            <label>
              Branch
              <input placeholder="Optional: e.g. main (blank = origin/HEAD)" value={serviceForm.branch} onChange={(event) => setServiceForm({ ...serviceForm, branch: event.target.value })} />
            </label>
            {serviceForm.type === 'PM2' ? (
              <label>
                PM2 process name
                <select value={serviceForm.pm2ProcessName} onChange={(event) => setServiceForm({ ...serviceForm, pm2ProcessName: event.target.value })} required>
                  <option value="">Choose PM2 process</option>
                  {pm2Processes.map((process) => <option key={process.name} value={process.name}>{process.name} ({process.status || 'unknown'})</option>)}
                </select>
              </label>
            ) : (
              <label>
                Static deploy directory
                <input placeholder="/usr/share/nginx/html/site" value={serviceForm.deployDirectory} onChange={(event) => setServiceForm({ ...serviceForm, deployDirectory: event.target.value })} required />
              </label>
            )}
            <label>
              Client
              <select value={serviceForm.clientId} onChange={(event) => setServiceForm({ ...serviceForm, clientId: event.target.value })} required>
                <option value="">Choose client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              VPS agent
              <select value={serviceForm.agentId} onChange={(event) => setServiceForm({ ...serviceForm, agentId: event.target.value })} required>
                <option value="">Choose agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Register service</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'edit-service'} title="Edit service" subtitle="Update the service metadata used for deployment." onClose={closeEditService}>
        <form className="modal-form" onSubmit={saveService}>
          <div className="form-columns">
            <label>
              Service name
              <input value={serviceEdit.name} onChange={(event) => setServiceEdit({ ...serviceEdit, name: event.target.value })} required minLength={2} />
            </label>
            <label>
              Branch
              <input placeholder="Blank = origin/HEAD" value={serviceEdit.branch} onChange={(event) => setServiceEdit({ ...serviceEdit, branch: event.target.value })} />
            </label>
            <label>
              Template
              <select value={serviceEdit.templateKey} onChange={(event) => setServiceEdit({ ...serviceEdit, templateKey: event.target.value })}>
                <option value="">Custom commands</option>
                {templates
                  .filter((template) => template.type === editingService?.type)
                  .map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Status
              <select value={serviceEdit.enabled ? 'true' : 'false'} onChange={(event) => setServiceEdit({ ...serviceEdit, enabled: event.target.value === 'true' })}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            {editingService?.type === 'PM2' ? (
              <label>
                PM2 process name
                <input value={serviceEdit.pm2ProcessName} onChange={(event) => setServiceEdit({ ...serviceEdit, pm2ProcessName: event.target.value })} required />
              </label>
            ) : (
              <label>
                Static deploy directory
                <input value={serviceEdit.deployDirectory} onChange={(event) => setServiceEdit({ ...serviceEdit, deployDirectory: event.target.value })} required />
              </label>
            )}
          </div>
          <p className="form-hint">Repository URL, project key, service type, client, and VPS agent are fixed after registration.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeEditService}>
              Cancel
            </button>
            <button type="submit">Save changes</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'access'}
        title="Add client access"
        subtitle="Create a FileZilla/SFTP or PostgreSQL credential entry for a client."
        onClose={closeAccessModal}
      >
        <form className="modal-form" onSubmit={createAccess}>
          {renderAccessFields('create')}
          <p className="form-hint">The client can view this entry from their console. Passwords are encrypted at rest.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeAccessModal}>
              Cancel
            </button>
            <button type="submit">Add access</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.kind || 'resource'}?`}
        subtitle={deleteTarget ? `${deleteTarget.label} will be permanently removed.` : ''}
        onClose={() => setDeleteTarget(null)}
      >
        <div className="admin-confirm">
          <p>{deleteTarget?.kind === 'service' ? 'Its deployment history will also be removed. This action cannot be undone.' : 'The client will no longer be able to use these credentials. This action cannot be undone.'}</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button type="button" className="danger-button" onClick={() => {
              const target = deleteTarget;
              setDeleteTarget(null);
              if (target?.kind === 'service') {
                const service = services.find((item) => item.id === target.id);
                if (service) void confirmDeleteService(service);
              } else if (target?.kind === 'access') {
                const access = accessEntries.find((item) => item.id === target.id);
                if (access) void confirmDeleteAccess(access);
              }
            }}>Delete permanently</button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modal === 'edit-access'}
        title="Edit client access"
        subtitle="Update the connection details shown to this client."
        onClose={closeAccessModal}
      >
        <form className="modal-form" onSubmit={saveAccess}>
          {renderAccessFields('edit')}
          <p className="form-hint">Leave the password blank to keep the existing password. The client and access owner cannot be changed.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeAccessModal}>
              Cancel
            </button>
            <button type="submit">Save changes</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'view-access'}
        title="Client access credentials"
        subtitle="Connection details visible to this client."
        onClose={closeAccessModal}
      >
        {viewingAccess ? (
          <div className="access-grid single">
            <AccessEntryCard entry={viewingAccess} onReveal={revealAdminAccess} />
          </div>
        ) : (
          <p className="muted">Access entry not found.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={closeAccessModal}>
            Close
          </button>
        </div>
      </Modal>

      <Modal open={modal === 'settings'} title="Console settings" subtitle="Control deployment log retention for all services." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={saveRetention}>
          <label>
            Deployment log retention <span>(days)</span>
            <input type="number" min="1" max="3650" value={retention} onChange={(event) => setRetention(Number(event.target.value))} required />
          </label>
          <p className="form-hint">Deployment metadata remains permanent. Only log entries are removed.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Save settings</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingSecret)}
        title={pendingSecret?.title || 'Secret'}
        subtitle="Shown once — record it securely before closing."
        onClose={() => setPendingSecret(null)}
      >
        {pendingSecret && (
          <div className="secret-dialog">
            <pre className="secret-dialog__value">{pendingSecret.value}</pre>
            {pendingSecret.note && <p className="form-hint">{pendingSecret.note}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary copy-secret-button"
                onClick={() => { void navigator.clipboard?.writeText(pendingSecret.value); }}
              >
                Copy to clipboard
              </button>
              <button type="button" onClick={() => setPendingSecret(null)}>Done</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

export default AdminPanel;
