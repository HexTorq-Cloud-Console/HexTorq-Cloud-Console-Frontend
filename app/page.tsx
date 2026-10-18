'use client';

import { FormEvent, useEffect, useState } from 'react';
import Script from 'next/script';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

declare global { interface Window { google?: { accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } } }

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  async function signInWithGoogle(credential: string) {
    setMessage('Signing inâ€¦');
    const response = await fetch(`${apiUrl}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message || 'Google sign-in failed');
    localStorage.setItem('hextorq_token', data.token); setToken(data.token); setRole(data.user.role); setForcePasswordChange(Boolean(data.user.forcePasswordChange));
  }

  function initializeGoogle() {
    const element = document.getElementById('google-button');
    if (!element || !window.google || !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({ client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, callback: ({ credential }) => signInWithGoogle(credential) });
    window.google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', width: '330' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Signing inâ€¦');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to sign in');
      localStorage.setItem('hextorq_token', data.token);
      setToken(data.token);
      setRole(data.user.role);
      setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sign in'); }
  }

  if (token) return forcePasswordChange ? <PasswordChange token={token} onComplete={() => setForcePasswordChange(false)} /> : <Dashboard token={token} role={role} />;
  return <main className="login-shell"><Script src="https://accounts.google.com/gsi/client" onLoad={initializeGoogle} /><section className="login-card"><p className="eyebrow">HEX TORQ CLOUD</p><h1>Cloud Console</h1><p className="muted">Manage deployments across every connected VPS.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit">Sign in</button></form><div id="google-button" className="google-button" />{message && <p className="message">{message}</p>}<p className="help">Need access? Contact your HexTorq administrator.</p></section></main>;
}

function PasswordChange({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) return setMessage('Passwords must match and contain at least 8 characters.');
    const response = await fetch(`${apiUrl}/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.message || 'Unable to change password');
    onComplete();
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">FIRST LOGIN</p><h1>Set your password</h1><p className="muted">Your administrator provided a temporary password. Choose a private password before continuing.</p><form onSubmit={submit}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label><label>Confirm password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} /></label><button type="submit">Save password</button></form>{message && <p className="error">{message}</p>}</section></main>;
}

function Dashboard({ token, role }: { token: string; role: string }) {
  const [services, setServices] = useState<Array<{ id: string; name: string; type: string; client: { name: string }; agent: { name: string } }>>([]);
  const [deployments, setDeployments] = useState<Array<{ id: string; runId: string; status: string; triggerSource: string; startedAt: string; completedAt?: string; durationMs?: number; service: { name: string } }>>([]);
  const [error, setError] = useState('');
  const [deploying, setDeploying] = useState<string | null>(null);
  const [pm2Action, setPm2Action] = useState<string | null>(null);
  const [pm2Status, setPm2Status] = useState<Record<string, { status?: string; cpu?: number; memory?: number; restarts?: number }>>({});
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<Array<{ timestamp: string; message: string }>>([]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch(`${apiUrl}/services`, { headers }), fetch(`${apiUrl}/deployments`, { headers })])
      .then(async ([serviceResponse, deploymentResponse]) => {
        const serviceData = await serviceResponse.json();
        const deploymentData = await deploymentResponse.json();
        if (!serviceResponse.ok) throw new Error(serviceData.message);
        if (!deploymentResponse.ok) throw new Error(deploymentData.message);
        setServices(serviceData.services);
        setDeployments(deploymentData.deployments);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load services'));
  }, [token]);

  useEffect(() => {
    services.filter((service) => service.type === 'PM2').forEach(async (service) => {
      const response = await fetch(`${apiUrl}/services/${service.id}/pm2/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setPm2Status((current) => ({ ...current, [service.id]: data })); }
    });
  }, [services, token]);

  useEffect(() => {
    if (!selectedDeployment) return;
    let active = true;
    const load = async () => { const response = await fetch(`${apiUrl}/deployments/${selectedDeployment}/logs`, { headers: { Authorization: `Bearer ${token}` } }); if (response.ok && active) { const data = await response.json(); setDeploymentLogs(data.logs); } };
    load(); const timer = window.setInterval(load, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedDeployment, token]);

  function signOut() { localStorage.removeItem('hextorq_token'); window.location.reload(); }
  async function deploy(serviceId: string) {
    setDeploying(serviceId);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/services/${serviceId}/deploy`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Deployment request failed');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Deployment request failed'); }
    finally { setDeploying(null); }
  }
  async function controlPm2(serviceId: string, action: string) {
    if (!window.confirm(`Confirm PM2 ${action}?`)) return;
    setPm2Action(`${serviceId}:${action}`);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/services/${serviceId}/pm2/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'PM2 action failed');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'PM2 action failed'); }
    finally { setPm2Action(null); }
  }
  return <main className="console-shell"><header className="topbar"><div><p className="eyebrow">HEX TORQ CLOUD</p><h1>Cloud Console</h1></div><button className="secondary" onClick={signOut}>Sign out</button></header>{role === 'SUPER_ADMIN' && <AdminPanel token={token} /> }<section className="welcome"><p className="muted">Connected services</p><h2>Service overview</h2>{error && <p className="error">{error}</p>}{services.length === 0 && !error ? <p className="muted">No services have been configured yet.</p> : <div className="service-grid">{services.map((service) => <article className="service-card" key={service.id}><div className="service-status" /><h3>{service.name}</h3><p>{service.type.replace('_', ' ')} Â· {service.agent.name}</p><small>{service.client.name}</small>{service.type === 'PM2' && pm2Status[service.id] && <p className="pm2-status">{pm2Status[service.id].status || 'unknown'} · CPU {pm2Status[service.id].cpu ?? 0}% · {Math.round((pm2Status[service.id].memory || 0) / 1024 / 1024)} MB · {pm2Status[service.id].restarts || 0} restarts</p>}<button className="deploy-button" onClick={() => deploy(service.id)} disabled={deploying === service.id}>{deploying === service.id ? 'Requestingâ€¦' : 'Redeploy'}</button>{service.type === 'PM2' && <div className="pm2-actions">{['start', 'stop', 'restart', 'reload'].map((action) => <button className="pm2-button" key={action} onClick={() => controlPm2(service.id, action)} disabled={pm2Action === `${service.id}:${action}`}>{pm2Action === `${service.id}:${action}` ? 'â€¦' : action}</button>)}</div>}</article>)}</div>}<div className="history-heading"><p className="muted">Permanent deployment metadata</p><h2>Deployment history</h2></div>{deployments.length === 0 ? <p className="muted">No deployments recorded yet.</p> : <div className="history-table"><div className="history-row history-header"><span>Service</span><span>Status</span><span>Trigger</span><span>Started</span><span>Duration</span></div>{deployments.map((deployment) => <div className="history-row" key={deployment.id} onClick={() => setSelectedDeployment(deployment.id)}><strong>{deployment.service.name}</strong><span className={`badge ${deployment.status.toLowerCase()}`}>{deployment.status}</span><span>{deployment.triggerSource}</span><span>{new Date(deployment.startedAt).toLocaleString()}</span><span>{deployment.durationMs ? `${Math.round(deployment.durationMs / 1000)}s` : 'Running'}</span></div>)}</div>}{selectedDeployment && <div className="deployment-detail"><div className="detail-header"><h3>Deployment details</h3><button className="secondary" onClick={() => setSelectedDeployment(null)}>Close</button></div><pre>{deploymentLogs.map((log) => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`).join("\\n") || "Waiting for deployment logs…"}</pre></div>}</section></main>;
}

function AdminPanel({ token }: { token: string }) {
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string; _count: { services: number } }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; baseUrl: string; enabled: boolean }>>([]);
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; type: string }>>([]);
  const [retention, setRetention] = useState(30);
  const [clientForm, setClientForm] = useState({ name: '', email: '', temporaryPassword: '' });
  const [agentForm, setAgentForm] = useState({ name: '', baseUrl: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', slug: '', type: 'PM2', repositoryUrl: '', branch: 'main', projectKey: '', workingDirectory: '', deployDirectory: '', pm2ProcessName: '', templateKey: '', clientId: '', agentId: '' });
  const [notice, setNotice] = useState('');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function refresh() {
    const [clientResponse, agentResponse, templateResponse, settingsResponse] = await Promise.all([fetch(`${apiUrl}/admin/clients`, { headers }), fetch(`${apiUrl}/admin/agents`, { headers }), fetch(`${apiUrl}/templates`, { headers }), fetch(`${apiUrl}/admin/settings`, { headers })]);
    const clientData = await clientResponse.json(); const agentData = await agentResponse.json(); const templateData = await templateResponse.json(); const settingsData = await settingsResponse.json();
    if (!clientResponse.ok) throw new Error(clientData.message); if (!agentResponse.ok) throw new Error(agentData.message);
    setClients(clientData.clients); setAgents(agentData.agents); setTemplates(templateData.templates || []); setRetention(settingsData.logRetentionDays || 30);
  }
  useEffect(() => { refresh().catch((reason) => setNotice(reason instanceof Error ? reason.message : 'Unable to load administration data')); }, []);
  async function createClient(event: FormEvent) { event.preventDefault(); const response = await fetch(`${apiUrl}/admin/clients`, { method: 'POST', headers, body: JSON.stringify(clientForm) }); const data = await response.json(); if (!response.ok) return setNotice(data.message); setNotice(`Client created. Temporary password: ${data.temporaryPassword}`); setClientForm({ name: '', email: '', temporaryPassword: '' }); refresh(); }
  async function createAgent(event: FormEvent) { event.preventDefault(); const response = await fetch(`${apiUrl}/admin/agents`, { method: 'POST', headers, body: JSON.stringify(agentForm) }); const data = await response.json(); if (!response.ok) return setNotice(data.message); setNotice(`Agent created. Enrollment token: ${data.enrollmentToken}`); setAgentForm({ name: '', baseUrl: '' }); refresh(); }
  async function createService(event: FormEvent) { event.preventDefault(); const response = await fetch(`${apiUrl}/admin/services`, { method: 'POST', headers, body: JSON.stringify({ ...serviceForm, deployDirectory: serviceForm.type === 'STATIC_FRONTEND' ? serviceForm.deployDirectory : undefined, pm2ProcessName: serviceForm.type === 'PM2' ? serviceForm.pm2ProcessName : undefined }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message); setNotice(`Service ${data.service.name} created.`); setServiceForm({ ...serviceForm, name: '', slug: '', repositoryUrl: '', projectKey: '', workingDirectory: '', deployDirectory: '', pm2ProcessName: '' }); }
  async function saveRetention(event: FormEvent) { event.preventDefault(); const response = await fetch(`${apiUrl}/admin/settings`, { method: 'PATCH', headers, body: JSON.stringify({ logRetentionDays: retention }) }); const data = await response.json(); setNotice(response.ok ? `Log retention set to ${data.logRetentionDays} days.` : data.message); }
  return <section className="admin-panel"><div><p className="eyebrow">SUPER ADMIN</p><h2>Administration</h2>{notice && <p className="message">{notice}</p>}</div><div className="admin-grid"><form className="admin-form" onSubmit={createClient}><h3>New client</h3><input placeholder="Client name" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} required /><input placeholder="Email" type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} required /><input placeholder="Temporary password (optional)" value={clientForm.temporaryPassword} onChange={(event) => setClientForm({ ...clientForm, temporaryPassword: event.target.value })} /><button type="submit">Create client</button></form><form className="admin-form" onSubmit={createAgent}><h3>Register VPS agent</h3><input placeholder="Agent name" value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} required /><input placeholder="Agent base URL" type="url" value={agentForm.baseUrl} onChange={(event) => setAgentForm({ ...agentForm, baseUrl: event.target.value })} required /><button type="submit">Register agent</button></form></div><form className="admin-form service-form" onSubmit={createService}><h3>Register service</h3><div className="form-columns"><input placeholder="Service name" value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} required /><input placeholder="Slug, e.g. cctv-backend" value={serviceForm.slug} onChange={(event) => setServiceForm({ ...serviceForm, slug: event.target.value })} required /><select value={serviceForm.type} onChange={(event) => setServiceForm({ ...serviceForm, type: event.target.value })}><option value="PM2">PM2 backend</option><option value="STATIC_FRONTEND">Static frontend</option></select><input placeholder="Project key / webhook project" value={serviceForm.projectKey} onChange={(event) => setServiceForm({ ...serviceForm, projectKey: event.target.value })} required /><select value={serviceForm.templateKey} onChange={(event) => setServiceForm({ ...serviceForm, templateKey: event.target.value })}><option value="">Choose template</option>{templates.filter((template) => template.type === serviceForm.type).map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}</select><input placeholder="Repository URL" type="url" value={serviceForm.repositoryUrl} onChange={(event) => setServiceForm({ ...serviceForm, repositoryUrl: event.target.value })} required /><input placeholder="Working directory" value={serviceForm.workingDirectory} onChange={(event) => setServiceForm({ ...serviceForm, workingDirectory: event.target.value })} required /><input placeholder="Branch" value={serviceForm.branch} onChange={(event) => setServiceForm({ ...serviceForm, branch: event.target.value })} required />{serviceForm.type === 'PM2' ? <input placeholder="PM2 process name" value={serviceForm.pm2ProcessName} onChange={(event) => setServiceForm({ ...serviceForm, pm2ProcessName: event.target.value })} required /> : <input placeholder="Static deploy directory" value={serviceForm.deployDirectory} onChange={(event) => setServiceForm({ ...serviceForm, deployDirectory: event.target.value })} required />}<select value={serviceForm.clientId} onChange={(event) => setServiceForm({ ...serviceForm, clientId: event.target.value })} required><option value="">Choose client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select value={serviceForm.agentId} onChange={(event) => setServiceForm({ ...serviceForm, agentId: event.target.value })} required><option value="">Choose VPS agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></div><button type="submit">Register service</button></form><form className="retention-form" onSubmit={saveRetention}><label>Deployment log retention (days)<input type="number" min="1" max="3650" value={retention} onChange={(event) => setRetention(Number(event.target.value))} /></label><button type="submit">Save retention</button></form><div className="admin-lists"><div><h3>Clients ({clients.length})</h3>{clients.map((client) => <p key={client.id}><strong>{client.name}</strong><br /><small>{client.email} Â· {client._count.services} services</small></p>)}</div><div><h3>VPS agents ({agents.length})</h3>{agents.map((agent) => <p key={agent.id}><strong>{agent.name}</strong><br /><small>{agent.baseUrl} Â· {agent.enabled ? 'enabled' : 'disabled'}</small></p>)}</div></div></section>;
}



