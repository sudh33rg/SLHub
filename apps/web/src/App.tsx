import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtGb, fmtMbps, fmtCycle, fmtDate, initial, getSites, Me, Site, ApiAccount, ApiAccountOverview } from './api/client';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

/* ----------------------------- auth ----------------------------- */
function Login({ onAuth }: { onAuth: (m: Me) => void }) {
  const nav = useNavigate();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('admin123');
  const [e, setE] = useState('');
  const submit = async (ev?: any) => {
    ev?.preventDefault();
    try {
      const r = await api.post('/auth/login', { username: u, password: p });
      localStorage.setItem('token', r.data.accessToken);
      localStorage.setItem('me', JSON.stringify(r.data.user));
      onAuth(r.data.user);
      nav('/');
    } catch {
      setE('Invalid username or password');
    }
  };
  return (
    <div className="login">
      <div className="loginCard">
        <div className="brand"><div className="logo">✦</div> Starlink Command Center</div>
        <h1>Welcome back</h1>
        <p>Sign in to monitor all your Starlink locations from one dashboard.</p>
        <form onSubmit={submit} className="loginForm">
          <label className="field">
            <span>Username</span>
            <input value={u} onChange={(x) => setU(x.target.value)} placeholder="Username" autoComplete="username" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={p} onChange={(x) => setP(x.target.value)} placeholder="Password" autoComplete="current-password" />
          </label>
          {e && <small className="error">{e}</small>}
          <button type="submit" className="loginBtn">Login</button>
        </form>
        <div className="demo">Demo login: admin / admin123</div>
      </div>
    </div>
  );
}

/* ----------------------------- shared bits ----------------------------- */
const COLORS = ['#635bff', '#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Card({ title, children, right }: { title?: string; children: any; right?: any }) {
  return (
    <div className="card">
      {title && <h3>{title}{right && <span className="cardRight">{right}</span>}</h3>}
      {children}
    </div>
  );
}

function toast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 2400);
}

/* ----------------------------- system status (real) ----------------------------- */
function SystemStatus({ reloadKey }: { reloadKey: number }) {
  const [sites, setSites] = useState<Site[] | null>(null);
  useEffect(() => {
    let alive = true;
    getSites().then((s) => alive && setSites(s)).catch(() => alive && setSites([]));
    return () => { alive = false; };
  }, [reloadKey]);
  const total = sites?.length ?? 0;
  const online = sites?.filter((s) => s.status?.toLowerCase() === 'online').length ?? 0;
  const offline = total - online;
  const allOnline = total > 0 && offline === 0;
  const linked = sites?.filter((s) => s.lastSyncMode === 'live') ?? [];
  const newestSync = linked.reduce((latest, s) => Math.max(latest, s.lastSyncAt ? new Date(s.lastSyncAt).getTime() : 0), 0);
  const stale = linked.length > 0 && (!newestSync || Date.now() - newestSync > 3 * 60 * 1000);
  const dot = !sites ? 'wait' : offline > 0 || stale ? 'warn' : allOnline ? 'ok' : 'ok';
  const label = !sites ? 'Checking live systems…' : offline > 0 ? `${offline} site(s) require attention` : stale ? 'Live data is stale' : allOnline ? 'All systems operational' : 'No linked live sites';
  return (
    <div className="system">
      <span className={`sysDot ${dot}`} />
      <b>System Status</b>
      <div className="muted" style={{ marginTop: 4 }}>
        {label}
        {sites && <><br />{online} online · {offline} offline · {total} total<br /><small>{newestSync ? `Last live poll ${fmtDate(new Date(newestSync).toISOString())}` : 'No live poll recorded'}</small></>}
      </div>
    </div>
  );
}

/* ----------------------------- site detail drawer ----------------------------- */
function DrawerRow({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="dRow">
      <span className="dMuted">{label}</span>
      <span className="dValue" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

/**
 * Slide-in site detail drawer (themed like the reference monitoring panel).
 * All data is real: site fields from the DB + real avg-daily usage derived
 * from the time-series analytics endpoint (no fabrication).
 */
function SiteDrawer({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const [daily, setDaily] = useState<any[]>([]);
  const [dailyErr, setDailyErr] = useState(false);

  useEffect(() => {
    if (!site) return;
    setDaily([]); setDailyErr(false);
    api.get('/analytics/daily', { params: { siteId: site.id } })
      .then((r) => setDaily(r.data || []))
      .catch(() => setDailyErr(true));
  }, [site]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (site) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [site, onClose]);

  const limit = site?.dataLimitGb && site.dataLimitGb > 0 ? site.dataLimitGb : null;
  const usage = site?.usageGb ?? 0;
  const topup = site?.topupUsedGb ?? 0;
  const pct = limit ? Math.min(100, Math.round((usage / limit) * 100)) : null;
  const remaining = limit ? Math.max(0, limit - usage) : null;
  // Real avg daily usage: sum of daily download+upload over the days that have data.
  const daysWithData = daily.filter((d) => d.totalGb > 0);
  const avgDaily = daysWithData.length
    ? daysWithData.reduce((a, d) => a + d.totalGb, 0) / daysWithData.length
    : 0;
  const subStatus = site?.subscriptionStatus || 'Active';
  const subAccent = subStatus === 'Active' ? 'var(--success-text)' : subStatus === 'Paused' ? 'var(--warning)' : 'var(--danger-text)';

  return (
    <aside className={`siteDrawer ${site ? 'open' : ''}`} aria-hidden={!site}>
      <button className="dClose" onClick={onClose} title="Close">×</button>
      {site && (
        <>
          <div className="dTitle">{site.name}</div>
          <div className="dSub">{site.accountName}</div>
          <div className="dStatusRow">
            <span className={site.status === 'Online' ? 'dStatus online' : 'dStatus offline'}>{site.status}</span>
            <span className="dSync">
              {site.lastSyncMode === 'live' ? 'live' : site.lastSyncMode === 'error' ? 'sync error' : 'not linked'}
            </span>
          </div>

          <div className="dCard">
            <h4>General Information</h4>
            <DrawerRow label="Account" value={site.accountName} />
            <DrawerRow label="Plan" value={site.plan} />
            <DrawerRow label="IP Policy" value={site.ipPolicy || 'Public IP'} />
            <DrawerRow label="Billing Cycle" value={fmtCycle(site.billingCycleStart, site.billingCycleEnd)} />
          </div>

          <div className="dCard">
            <h4>Usage Overview</h4>
            {limit ? (
              <>
                <div className="dUsageBig">{fmtGb(usage)} <span className="dMuted" style={{ fontSize: 14 }}>/ {fmtGb(limit)}</span></div>
                <div className="dProgress"><span style={{ width: `${pct}%` }} /></div>
                <DrawerRow label="Remaining" value={fmtGb(remaining!)} />
                <DrawerRow label="Top-up Used" value={fmtGb(topup)} />
              </>
            ) : (
              <DrawerRow label="Data limit" value="Not set" />
            )}
            <DrawerRow
              label="Avg Daily Usage"
              value={dailyErr ? 'unavailable' : avgDaily > 0 ? `${avgDaily.toFixed(1)} GB` : 'no usage recorded'}
            />
            {limit && <DrawerRow label="Usage %" value={`${pct}%`} />}
          </div>

          <div className="dCard">
            <h4>Starlink Subscription Details</h4>
            <DrawerRow label="Service" value={site.plan} />
            <DrawerRow label="Subscription" value={subStatus} accent={subAccent} />
            <DrawerRow label="Automatic Top-up" value={site.autoTopup ? 'Enabled' : 'Disabled'} />
          </div>

          <div className="dCard">
            <h4>Live Terminal Telemetry</h4>
            <DrawerRow label="Throughput" value={`${fmtMbps(site.downloadMbps)} / ${fmtMbps(site.uploadMbps)}`} />
            <DrawerRow label="Latency" value={`${site.latencyMs.toFixed(1)} ms`} />
            <DrawerRow label="Obstruction" value={site.obstructionPercent != null ? `${site.obstructionPercent.toFixed(2)}%` : '—'} />
            <DrawerRow label="PoP packet loss" value={site.popPingDropRate != null ? `${site.popPingDropRate.toFixed(3)}%` : '—'} />
            <DrawerRow label="Alerts" value={site.alertCount != null ? String(site.alertCount) : '—'} accent={site.alertCount ? 'var(--danger-text)' : undefined} />
            <DrawerRow label="Software" value={site.softwareVersion || '—'} />
          </div>

          <div className="dNotice">
            {site.lastSyncMode === 'live'
              ? `Live snapshot from Starlink V2 data-usage/query + telemetry/query. Last poll: ${fmtDate(site.lastSyncAt)}. The dashboard polls every 60 seconds; it is near-real-time, not a streaming socket.`
              : 'No live link — usage is the latest recorded value. Link a Starlink V2 API account + service line to enable live monitoring.'}
          </div>
        </>
      )}
    </aside>
  );
}

/* ----------------------------- dashboard ----------------------------- */
function Dashboard({ me, reloadKey }: { me: Me; reloadKey: number }) {
  const [summary, setSummary] = useState<any>({});
  const [monthly, setMonthly] = useState<any[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Site | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, m, s] = await Promise.all([api.get('/dashboard/summary'), api.get('/analytics/monthly'), api.get('/sites')]);
      setSummary(d.data); setMonthly(m.data); setSites(s.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load the live dashboard data.');
    } finally { setLoading(false); }
  }, [reloadKey]);

  useEffect(() => { load(); }, [load]);

  const statusData = useMemo(() => [
    { name: 'Online', value: summary.onlineSites || 0, color: '#16a34a' },
    { name: 'Offline', value: summary.offlineSites || 0, color: '#ef4444' },
  ], [summary]);

  const planDist = useMemo(() => {
    const map: Record<string, number> = {};
    sites.forEach((s) => { map[s.plan] = (map[s.plan] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sites]);

  return (
    <div>
      <div className="cards">
        <Card><span>Total Sites</span><strong>{summary.totalSites ?? '—'}</strong><small>Configured locations</small></Card>
        <Card><span>Online</span><strong className="okText">{summary.onlineSites ?? '—'}</strong><small>Healthy connections</small></Card>
        <Card><span>Offline</span><strong className="badText">{summary.offlineSites ?? '—'}</strong><small>Requires attention</small></Card>
        <Card><span>Total Usage</span><strong>{summary.usageGb != null ? fmtGb(summary.usageGb) : '—'}</strong><small>Current configured usage</small></Card>
        <Card><span>Last 30d Starlink Usage</span><strong>{summary.monthGb != null ? fmtGb(summary.monthGb) : '—'}</strong><small>Reported by Starlink</small></Card>
        <Card><span>Avg Throughput</span><strong>{summary.avgThroughputMbps != null ? fmtMbps(summary.avgThroughputMbps) : '—'}</strong><small>Live download (Mbps)</small></Card>
        <Card><span>Avg Latency</span><strong>{summary.avgLatencyMs != null ? `${summary.avgLatencyMs} ms` : '—'}</strong><small>Round-trip</small></Card>
        <Card><span>Health</span><strong>{summary.healthPercent ?? '—'}%</strong><small>Connection uptime</small></Card>
      </div>

      {loading ? <div className="card loadingState">Loading live Starlink data…</div> : error ? <div className="card errorState"><b>Dashboard unavailable</b><p>{error}</p><button className="ghost" onClick={load}>Try again</button></div> : (
        <>
          <div className="grid">
            <Card title="Monthly Data Usage (Starlink reported)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `${v} GB`} />
                  <Bar dataKey="downloadGb" name="Reported usage" fill="#635bff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Connection Health">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} label={(e: any) => `${e.name}: ${e.value}`}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="progress"><i style={{ width: `${summary.healthPercent || 0}%` }} /></div>
              <p className="muted">{summary.offlineSites} site(s) require attention.</p>
            </Card>
          </div>

          <div className="grid">
            <Card title="Throughput Trend (avg Mbps)">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#635bff" stopOpacity={0.5} /><stop offset="100%" stopColor="#635bff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtMbps(Number(v))} />
                  <Area type="monotone" dataKey="avgDownloadMbps" name="Download" stroke="#635bff" fill="url(#dd)" />
                  <Area type="monotone" dataKey="avgUploadMbps" name="Upload" stroke="#0ea5e9" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Sites by Plan">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={planDist} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Starlink Locations">
            <SiteTable sites={sites} compact onSelect={setSelected} />
          </Card>
        </>
      )}

      <SiteDrawer site={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* ----------------------------- site table + dialogs ----------------------------- */
function StatusPill({ s }: { s: string }) {
  return <span className={s === 'Online' ? 'ok' : 'bad'}>{s}</span>;
}

function SyncBadge({ mode, error, linked }: { mode?: string; error?: string; linked?: boolean }) {
  if (error) return <span className="bad" title={error}>FAILED</span>;
  if (mode === 'live') return <span className="ok">LIVE</span>;
  if (mode === 'none' || !linked) return <span className="muted" title="Not linked to a Starlink V2 API account — no live data">—</span>;
  return <span className="muted">—</span>;
}

function SiteTable({ sites, compact, onSelect }: { sites: Site[]; compact?: boolean; onSelect?: (s: Site) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Location</th><th>Account</th><th>Plan</th><th>Status</th><th>Usage</th><th>↓ / ↑ Mbps</th><th>Latency</th>{!compact && <th>Owner</th>}<th>Last Live Poll</th></tr></thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} className={onSelect ? 'clickable' : ''} onClick={onSelect ? () => onSelect(s) : undefined}>
              <td><b>{s.name}</b></td>
              <td>{s.accountName}</td>
              <td>{s.plan}</td>
              <td><StatusPill s={s.status} /></td>
              <td>{s.status === 'Offline' ? '—' : fmtGb(s.usageGb)}</td>
              <td>{s.status === 'Offline' ? '—' : `${fmtMbps(s.downloadMbps)} / ${fmtMbps(s.uploadMbps)}`}</td>
              <td>{s.status === 'Offline' ? '—' : `${s.latencyMs} ms`}</td>
              {!compact && <td>{s.ownerUsername || <em>all</em>}</td>}
              <td>{fmtDate(s.lastSyncAt)}</td>
            </tr>
          ))}
          {sites.length === 0 && <tr><td colSpan={9} className="muted">No sites match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SiteForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [form, setForm] = useState({ name: '', accountName: '', plan: '', status: 'Online', usageGb: 0, dataLimitGb: '', ipPolicy: 'Public IP', autoTopup: false, subscriptionStatus: 'Active', notes: '', ownerUsername: '', apiAccountId: '', serviceLineNumber: '', deviceId: '' });
  useEffect(() => { api.get('/accounts').then((r) => setAccounts(r.data)).catch(() => setAccounts([])); }, []);
  const submit = async (e: any) => {
    e.preventDefault();
    const payload: any = { ...form };
    delete payload.usageGb;
    if (form.dataLimitGb) payload.dataLimitGb = +form.dataLimitGb;
    if (form.apiAccountId) payload.apiAccountId = +form.apiAccountId;
    await api.post('/sites', payload);
    toast(form.apiAccountId ? 'Site added — linked to Starlink V2; refreshing to pull live data' : 'Site added — link a Starlink V2 API account to pull live data');
    onDone();
  };
  return (
    <form className="formGrid" onSubmit={submit}>
      <label>Location<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. WDCL Plant" /></label>
      <label>Account Name<input required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="e.g. Account 01" /></label>
      <label>Plan<input required value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="e.g. Local Priority 500GB" /></label>
      <label>Data Limit (GB)<input type="number" value={form.dataLimitGb} onChange={(e) => setForm({ ...form, dataLimitGb: e.target.value })} placeholder="e.g. 500 (blank = unlimited)" /></label>
      <label>IP Policy<select value={form.ipPolicy} onChange={(e) => setForm({ ...form, ipPolicy: e.target.value })}><option>Public IP</option><option>Carrier-Grade NAT</option></select></label>
      <label className="fieldHint">Billing Cycle<span>Populated from Starlink after linking a service line.</span></label>
      <label>Subscription<select value={form.subscriptionStatus} onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}><option>Active</option><option>Paused</option><option>Cancelled</option></select></label>
      <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Online</option><option>Offline</option></select></label>
      <label>Starlink API Account
        <select value={form.apiAccountId} onChange={(e) => setForm({ ...form, apiAccountId: e.target.value })}>
          <option value="">— not linked yet —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label>Service Line #<input value={form.serviceLineNumber} onChange={(e) => setForm({ ...form, serviceLineNumber: e.target.value })} placeholder="SL-ABC-123 (enables live sync)" /></label>
      <label>Device ID<input value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} placeholder="ut... (optional, for telemetry)" /></label>
      {me.role === 'admin' && <label>Owner (blank = all)<input value={form.ownerUsername} onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })} placeholder="operator" /></label>}
      <label style={{ gridColumn: '1 / -1' }}>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="optional" /></label>
      <div className="actions"><button className="primary" type="submit">Add Site</button></div>
    </form>
  );
}

function SitesPage({ me, reloadKey }: { me: Me; reloadKey: number }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState<Site | null>(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<Site | null>(null);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [discover, setDiscover] = useState<{ open: boolean; accountId: number | ''; loading: boolean; lines: any[]; terminals: Record<string, any[]>; error: string | null }>(
    { open: false, accountId: '', loading: false, lines: [], terminals: {}, error: null },
  );

  useEffect(() => { api.get('/accounts').then((r) => setAccounts(r.data)).catch(() => setAccounts([])); }, [reloadKey]);

  const openDiscover = () => {
    setDiscover({ open: true, accountId: accounts[0]?.id ?? '', loading: false, lines: [], terminals: {}, error: null });
  };

  const runDiscover = async () => {
    if (!discover.accountId) { setDiscover((d) => ({ ...d, error: 'Select an API account' })); return; }
    setDiscover((d) => ({ ...d, loading: true, error: null, lines: [], terminals: {} }));
    try {
      const r = await api.post(`/accounts/${discover.accountId}/discover`);
      const terminalsBySl: Record<string, any[]> = {};
      for (const t of r.data.terminals || []) {
        if (t.serviceLineNumber) (terminalsBySl[t.serviceLineNumber] ||= []).push(t);
      }
      setDiscover((d) => ({ ...d, loading: false, lines: r.data.serviceLines || [], terminals: terminalsBySl }));
    } catch (e: any) {
      setDiscover((d) => ({ ...d, loading: false, error: e?.response?.data?.message || e?.message || 'Discovery failed' }));
    }
  };

  const createFromLine = async (line: any) => {
    const term = discover.terminals[line.serviceLineNumber]?.[0];
    const payload: any = {
      name: line.nickname || line.serviceLineNumber,
      accountName: accounts.find((a) => a.id === +discover.accountId)?.name || 'Starlink',
      plan: line.servicePlan || 'Priority',
      status: 'Online',
      apiAccountId: +discover.accountId,
      serviceLineNumber: line.serviceLineNumber,
    };
    if (term?.userTerminalId) payload.deviceId = term.userTerminalId;
    await api.post('/sites', payload);
    toast(`Created site for ${line.serviceLineNumber}${term?.userTerminalId ? ' (with live device)' : ''}`);
    load();
  };

  const addAll = async () => {
    for (const line of discover.lines) await createFromLine(line);
    setDiscover((d) => ({ ...d, open: false }));
    toast(`Created ${discover.lines.length} site(s) from Starlink`);
  };

  const load = useCallback(async () => {
    const r = await api.get('/sites', { params: { q: query } });
    setSites(r.data);
  }, [query, reloadKey]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async (id: number) => {
    if (!confirm('Delete this site?')) return;
    await api.delete(`/sites/${id}`);
    toast('Site deleted');
    load();
  };

  const doSync = async (id: number) => {
    await api.post(`/sites/${id}/sync`);
    toast('Synced live from Starlink V2');
    load();
  };

  const doSyncAll = async () => {
    try {
      const r = await api.post('/sites/refresh');
      const results = r.data.results || [];
      const ok = results.filter((x: any) => x.ok).length;
      if (ok === 0 && results.length === 0) {
        toast('No linked sites to sync — link a site to a Starlink API Account + service line first');
      } else if (ok < results.length) {
        const first = results.find((x: any) => !x.ok);
        toast(`Synced ${ok}/${results.length} sites; ${first?.name}: ${first?.error}`);
      } else {
        toast(`Synced ${ok} site(s) live from Starlink V2`);
      }
    } catch (e: any) {
      toast(`Sync failed: ${e?.response?.data?.message || e?.message || 'error'}`);
    }
    load();
  };

  return (
    <div>
      <div className="tableHead">
        <h3 style={{ margin: 0 }}>Starlink Sites</h3>
        <div className="row">
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search location…" />
          {me.role === 'admin' && <button className="ghost" onClick={doSyncAll} title="Sync every site (live when linked)">Sync All</button>}
          {me.role === 'admin' && <button className="ghost" onClick={openDiscover} title="Pull real service lines from the Starlink V2 API">Discover service lines</button>}
          {me.role !== 'viewer' && <button className="primary" onClick={() => { setEdit(null); setShowForm((v) => !v); }}>{showForm ? 'Close' : 'Add Site'}</button>}
        </div>
      </div>
      {showForm && <Card><SiteForm me={me} onDone={() => { setShowForm(false); load(); }} /></Card>}
      {edit && <Card title={`Edit ${edit.name}`}><EditSite site={edit} me={me} onDone={() => { setEdit(null); load(); }} /></Card>}
      <div className="tableHead" style={{ marginTop: 8 }}><span className="muted">{sites.length} sites · LIVE = pulled from Starlink V2, FAILED = live error (see tooltips), — = not linked to an API account</span></div>
      <Card>
        <table className="table-wrap">
          <thead><tr><th>Location</th><th>Account</th><th>Plan</th><th>Status</th><th>Sync</th><th>Usage</th><th>Owner</th><th>Last Sync</th><th>Actions</th></tr></thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setSelected(s)}>
                <td><b>{s.name}</b>{s.serviceLineNumber && <small className="muted"> · {s.serviceLineNumber}</small>}</td>
                <td>{s.accountName}</td>
                <td>{s.plan}</td>
                <td><StatusPill s={s.status} /></td>
                <td><SyncBadge mode={s.lastSyncMode} error={s.lastError} linked={!!(s.apiAccountId && s.serviceLineNumber)} /></td>
                <td>{s.status === 'Offline' ? '—' : fmtGb(s.usageGb)}</td>
                <td>{s.ownerUsername || <em>all</em>}</td>
                <td>{fmtDate(s.lastSyncAt)}</td>
                <td className="row" onClick={(e) => e.stopPropagation()}>
                  {me.role !== 'viewer' && <><button className="ghost" onClick={() => doSync(s.id)}>Sync</button>
                  <button className="ghost" onClick={() => setEdit(s)}>Edit</button>
                  <button className="ghost danger" onClick={() => doDelete(s.id)}>Del</button></>}
                </td>
              </tr>
            ))}
            {sites.length === 0 && <tr><td colSpan={9} className="muted">No sites match.</td></tr>}
          </tbody>
        </table>
      </Card>

      {discover.open && (
        <div className="modal-backdrop" onClick={() => setDiscover((d) => ({ ...d, open: false }))}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Discover service lines</h3><button className="ghost" onClick={() => setDiscover((d) => ({ ...d, open: false }))}>Close</button></div>
            <p className="muted">Pull the real service lines (and devices) from your Starlink V2 API account and create linked sites in one click.</p>
            <div className="row">
              <select value={discover.accountId} onChange={(e) => setDiscover((d) => ({ ...d, accountId: e.target.value ? +e.target.value : '' }))}>
                <option value="">— select API account —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button className="primary" onClick={runDiscover} disabled={discover.loading}>{discover.loading ? 'Discovering…' : 'Discover'}</button>
            </div>
            {discover.error && <p className="bad" style={{ color: '#ef4444' }}>{discover.error}</p>}
            {discover.lines.length > 0 && (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{discover.lines.length} service line(s) found</span>
                  <button className="ghost" onClick={addAll}>Add all as sites</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Service Line</th><th>Nickname</th><th>Plan</th><th>Device</th><th></th></tr></thead>
                    <tbody>
                      {discover.lines.map((l) => {
                        const term = discover.terminals[l.serviceLineNumber]?.[0];
                        return (
                          <tr key={l.serviceLineNumber}>
                            <td><b>{l.serviceLineNumber}</b></td>
                            <td>{l.nickname || '—'}</td>
                            <td>{l.servicePlan || '—'}</td>
                            <td>{term?.userTerminalId ? <span className="ok">linked</span> : <span className="muted">none</span>}</td>
                            <td className="row"><button className="ghost" onClick={() => createFromLine(l)}>Add site</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!discover.loading && discover.lines.length === 0 && !discover.error && discover.accountId && <p className="muted">No service lines returned for this account.</p>}
          </div>
        </div>
      )}

      <SiteDrawer site={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function EditSite({ site, me, onDone }: { site: Site; me: Me; onDone: () => void }) {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [f, setF] = useState({ ...site, ownerUsername: undefined as string | undefined, apiAccountId: site.apiAccountId ? String(site.apiAccountId) : '', serviceLineNumber: site.serviceLineNumber || '', deviceId: site.deviceId || '', dataLimitGb: site.dataLimitGb ?? '', ipPolicy: site.ipPolicy || 'Public IP', autoTopup: !!site.autoTopup, subscriptionStatus: site.subscriptionStatus || 'Active' });
  useEffect(() => { api.get('/accounts').then((r) => setAccounts(r.data)).catch(() => setAccounts([])); }, []);
  const submit = async (e: any) => {
    e.preventDefault();
    const { id, createdAt, updatedAt, lastSyncAt, ...rest } = f as any;
    const payload: any = { ...rest };
    delete payload.lastSyncMode; delete payload.lastError;
    delete payload.billingCycle; delete payload.billingCycleStart; delete payload.billingCycleEnd;
    delete payload.terminalState; delete payload.softwareVersion; delete payload.uptimeSeconds;
    delete payload.obstructionPercent; delete payload.popPingDropRate; delete payload.signalQuality; delete payload.alertCount;
    // Live metrics must only come from Starlink, never from an edit form.
    delete payload.usageGb; delete payload.downloadMbps; delete payload.uploadMbps; delete payload.latencyMs;
    if (payload.apiAccountId) payload.apiAccountId = +payload.apiAccountId; else delete payload.apiAccountId;
    if (payload.dataLimitGb) payload.dataLimitGb = +payload.dataLimitGb; else delete payload.dataLimitGb;
    await api.patch(`/sites/${site.id}`, payload);
    toast('Site updated');
    onDone();
  };
  return (
    <form className="formGrid" onSubmit={submit}>
      <label>Location<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Account<input required value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></label>
      <label>Plan<input value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></label>
      <label>Data Limit (GB)<input type="number" value={f.dataLimitGb} onChange={(e) => setF({ ...f, dataLimitGb: e.target.value })} placeholder="blank = unlimited" /></label>
      <label>IP Policy<select value={f.ipPolicy} onChange={(e) => setF({ ...f, ipPolicy: e.target.value })}><option>Public IP</option><option>Carrier-Grade NAT</option></select></label>
      <label className="fieldHint">Billing Cycle<span>{fmtCycle(site.billingCycleStart, site.billingCycleEnd)} · live from Starlink</span></label>
      <label>Subscription<select value={f.subscriptionStatus} onChange={(e) => setF({ ...f, subscriptionStatus: e.target.value })}><option>Active</option><option>Paused</option><option>Cancelled</option></select></label>
      <label>Auto Top-up<input type="checkbox" checked={f.autoTopup} onChange={(e) => setF({ ...f, autoTopup: e.target.checked })} /></label>
      <label>Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Online</option><option>Offline</option></select></label>
      <label>Starlink API Account
        <select value={f.apiAccountId} onChange={(e) => setF({ ...f, apiAccountId: e.target.value })}>
          <option value="">— not linked yet —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label>Service Line #<input value={f.serviceLineNumber} onChange={(e) => setF({ ...f, serviceLineNumber: e.target.value })} placeholder="SL-ABC-123" /></label>
      <label>Device ID<input value={f.deviceId} onChange={(e) => setF({ ...f, deviceId: e.target.value })} placeholder="ut..." /></label>
      {me.role === 'admin' && <label>Owner<input value={f.ownerUsername ?? ''} onChange={(e) => setF({ ...f, ownerUsername: e.target.value })} placeholder="blank = all" /></label>}
      <label style={{ gridColumn: '1 / -1' }}>Notes<input value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="actions"><button className="primary" type="submit">Save</button></div>
    </form>
  );
}

/* ----------------------------- analytics ----------------------------- */
function AnalyticsPage({ me, reloadKey }: { me: Me; reloadKey: number }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<string>('');
  const [daily, setDaily] = useState<any[]>([]);
  const [throughput, setThroughput] = useState<any[]>([]);

  useEffect(() => { api.get('/sites').then((r) => setSites(r.data)); }, []);

  const load = useCallback(async () => {
    const [d, t] = await Promise.all([
      api.get('/analytics/daily', { params: { siteId: siteId || undefined } }),
      api.get('/analytics/throughput', { params: { siteId: siteId || undefined } }),
    ]);
    setDaily(d.data); setThroughput(t.data);
  }, [siteId, reloadKey]);

  useEffect(() => { load(); }, [load]);

  const totalTraffic = daily.reduce((a, r) => a + r.totalGb, 0);

  return (
    <div>
      <div className="tableHead">
        <h3 style={{ margin: 0 }}>Usage & Analytics</h3>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="cards">
        <Card><span>Period Starlink Usage</span><strong>{fmtGb(totalTraffic)}</strong><small>Last 30 days · reported</small></Card>
        <Card><span>Avg Download</span><strong>{throughput.length ? fmtMbps(throughput.reduce((a, r) => a + r.avgDownloadMbps, 0) / throughput.length) : '—'}</strong><small>30-day mean · Mbps</small></Card>
        <Card><span>Avg Upload</span><strong>{throughput.length ? fmtMbps(throughput.reduce((a, r) => a + r.avgUploadMbps, 0) / throughput.length) : '—'}</strong><small>30-day mean · Mbps</small></Card>
        <Card><span>Avg Latency</span><strong>{throughput.length ? (throughput.reduce((a, r) => a + r.avgLatencyMs, 0) / throughput.length).toFixed(1) : '—'} ms</strong><small>30-day mean</small></Card>
      </div>
      <Card title="Daily Starlink Data Usage (last 30 days)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `${v} GB`} />
            <Bar dataKey="downloadGb" name="Reported usage" fill="#635bff" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Throughput over time">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={throughput}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => fmtMbps(Number(v))} />
            <Line type="monotone" dataKey="avgDownloadMbps" name="Download" stroke="#635bff" dot={false} />
            <Line type="monotone" dataKey="avgUploadMbps" name="Upload" stroke="#0ea5e9" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ----------------------------- API accounts ----------------------------- */
function AccountsPage({ me, reloadKey }: { me: Me; reloadKey: number }) {
  const [accs, setAccs] = useState<ApiAccount[]>([]);
  const [f, setF] = useState({ name: '', clientId: '', clientSecret: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [overview, setOverview] = useState<ApiAccountOverview | null>(null);
  const [overviewFor, setOverviewFor] = useState<ApiAccount | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const load = useCallback(() => { api.get('/accounts').then((r) => setAccs(r.data)); }, [reloadKey]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: any) => {
    e.preventDefault();
    const payload: { name: string; clientId: string; clientSecret?: string } = { name: f.name, clientId: f.clientId };
    if (f.clientSecret) payload.clientSecret = f.clientSecret;
    if (editingId) await api.patch(`/accounts/${editingId}`, payload);
    else await api.post('/accounts', payload);
    setF({ name: '', clientId: '', clientSecret: '' });
    setEditingId(null);
    toast(editingId ? 'Starlink V2 account updated' : 'Starlink V2 credentials saved (encrypted)');
    load();
  };

  const edit = (account: ApiAccount) => {
    setEditingId(account.id);
    setF({ name: account.name, clientId: account.clientId, clientSecret: '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setF({ name: '', clientId: '', clientSecret: '' });
  };

  const remove = async (account: ApiAccount) => {
    if (!confirm(`Delete API account "${account.name}"? Sites linked to it will no longer be able to sync live.`)) return;
    try {
      await api.delete(`/accounts/${account.id}`);
      if (editingId === account.id) cancelEdit();
      toast('API account deleted');
      load();
    } catch (e: any) {
      toast(`Delete failed: ${e?.response?.data?.message || e?.message || 'error'}`);
    }
  };

  const testConn = async (id: number) => {
    try {
      const r = await api.post(`/accounts/${id}/test-connection`);
      if (r.data.ok) toast(`Connected ✓ Account: ${r.data.name || r.data.accountNumber || 'unknown'}`);
      else toast(`Connection failed: ${r.data.error}`);
    } catch (e: any) {
      toast(`Test failed: ${e?.response?.data?.error || e?.message || 'error'}`);
    }
  };

  const inspect = async (account: ApiAccount) => {
    setOverviewFor(account); setOverview(null); setOverviewLoading(true);
    try { setOverview((await api.get(`/accounts/${account.id}/overview`)).data); }
    catch (e: any) { toast(`Live account overview failed: ${e?.response?.data?.message || e?.message || 'error'}`); }
    finally { setOverviewLoading(false); }
  };

  const livePoolCount = overview
    ? Math.max(overview.dataPools?.length ?? 0, new Set((overview.usageServiceLines || []).flatMap((u: any) => (u.billingCycles || []).flatMap((c: any) => (c.dataPoolUsage || []).map((p: any) => p.dataPoolId).filter(Boolean)))).size)
    : 0;

  return (
    <Card title="Starlink V2 API Accounts" right={<span className="muted">Credentials encrypted at rest (AES-256-GCM)</span>}>
      <p className="muted">Connect a Starlink V2 Business Network service account. Secrets are stored encrypted on the backend and never sent to the browser unencrypted.</p>
      {me.role === 'admin' && <form className="formGrid" onSubmit={submit}>
        <label>Account / Site<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="WDCL Plant" /></label>
        <label>Client ID<input required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} placeholder="client-..." /></label>
        <label>Client Secret<input required={!editingId} type="password" value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })} placeholder={editingId ? 'Leave blank to keep current secret' : '•••••'} /></label>
        <div className="actions"><button className="primary" type="submit">{editingId ? 'Update Configuration' : 'Save Configuration'}</button>{editingId && <button className="ghost" type="button" onClick={cancelEdit}>Cancel</button>}</div>
      </form>}
      <div className="tableHead" style={{ marginTop: 8 }}><span className="muted">{accs.length} configured</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Client ID</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {accs.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.clientId}</td><td><span className="ok">{a.secretConfigured ? 'Configured' : 'Incomplete'}</span></td><td className="row"><button className="ghost" onClick={() => inspect(a)}>Live overview</button><button className="ghost" onClick={() => testConn(a.id)} disabled={me.role !== 'admin'}>Test</button>{me.role === 'admin' && <><button className="ghost" onClick={() => edit(a)}>Edit</button><button className="ghost danger" onClick={() => remove(a)}>Delete</button></>}</td></tr>
            ))}
            {accs.length === 0 && <tr><td colSpan={4} className="muted">No API accounts yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {overviewFor && <div className="accountOverview">
        <div className="tableHead"><h3>Live account overview · {overviewFor.name}</h3><button className="ghost" onClick={() => { setOverviewFor(null); setOverview(null); }}>Close</button></div>
        {overviewLoading ? <p className="muted">Fetching live account, service lines, terminals, usage, billing and catalog data…</p> : overview && <>
          <div className="overviewGrid">
            <div><span className="muted">Account</span><b>{overview.account?.accountName || overview.account?.enterpriseName || overview.account?.accountNumber || '—'}</b></div>
            <div><span className="muted">Region / mode</span><b>{[overview.account?.regionCode, overview.account?.mode].filter(Boolean).join(' · ') || '—'}</b></div>
            <div><span className="muted">Service lines</span><b>{overview.serviceLineCount}</b></div>
            <div><span className="muted">Terminals</span><b>{overview.terminalCount}</b></div>
          </div>
          <div className="coverageGrid">
            <div><span className="muted">Addresses</span><b>{overview.addresses?.length ?? 0}</b></div>
            <div><span className="muted">Products</span><b>{overview.products?.length ?? 0}</b></div>
            <div><span className="muted">Data pools</span><b>{livePoolCount}</b></div>
            <div><span className="muted">Usage feeds</span><b>{overview.usageServiceLines?.length ?? 0}</b></div>
            <div><span className="muted">Live fetch</span><b className="okText">OK</b></div>
          </div>
          <div className="overviewColumns"><div><h4>Balance</h4>{overview.balance.length ? overview.balance.map((b, i) => <div className="dRow" key={i}><span>{b.currency || '—'}</span><b>{b.balance ?? b.dueAmount ?? '—'}</b></div>) : <p className="muted">No balance returned.</p>}</div><div><h4>Recent invoices</h4>{overview.invoices.length ? overview.invoices.slice(0, 5).map((inv, i) => <div className="dRow" key={i}><span>{inv.invoiceDate ? fmtDate(inv.invoiceDate) : inv.invoiceId || '—'}</span><b>{inv.amountDue ?? inv.amount ?? '—'} {inv.currency || ''}</b></div>) : <p className="muted">No invoices returned.</p>}</div></div>
          <div className="liveList">
            <h4 style={{ margin: '8px 0 0' }}>Live service lines</h4>
            {(overview.serviceLines || []).map((line: any) => {
              const usage = (overview.usageServiceLines || []).find((u: any) => u.serviceLineNumber === line.serviceLineNumber);
              const cycle = usage?.billingCycles?.[usage.billingCycles.length - 1];
              return <div className="liveListRow" key={line.serviceLineNumber}><b>{line.nickname || line.serviceLineNumber}</b><span>{line.servicePlan?.name || line.productReferenceId || '—'}</span><span>{line.state || (line.active === false ? 'Inactive' : 'Active')}</span><span>{cycle ? fmtCycle(cycle.startDate, cycle.endDate) : 'Cycle unavailable'}</span></div>;
            })}
            {(overview.serviceLines || []).length === 0 && <p className="muted">No service lines returned for this account.</p>}
          </div>
          <div className="liveList">
            <h4 style={{ margin: '8px 0 0' }}>Live terminals</h4>
            {(overview.terminals || []).map((terminal: any) => <div className="liveListRow" key={terminal.userTerminalId}><b>{terminal.nickname || terminal.userTerminalId}</b><span>{terminal.serviceLineNumber || 'unassigned'}</span><span>{terminal.state || terminal.status || '—'}</span><span>{terminal.kitSerialNumber || terminal.dishSerialNumber || '—'}</span></div>)}
            {(overview.terminals || []).length === 0 && <p className="muted">No terminals returned for this account.</p>}
          </div>
          <div className="liveList">
            <h4 style={{ margin: '8px 0 0' }}>Live service addresses</h4>
            {(overview.addresses || []).map((address: any) => <div className="liveListRow" key={address.addressReferenceId}><b>{address.formattedAddress || (address.addressLines || []).join(', ') || address.addressReferenceId}</b><span>{address.locality || '—'}</span><span>{address.regionCode || address.region || '—'}</span><span>{address.latitude != null && address.longitude != null ? `${Number(address.latitude).toFixed(4)}, ${Number(address.longitude).toFixed(4)}` : '—'}</span></div>)}
            {(overview.addresses || []).length === 0 && <p className="muted">No addresses returned for this account.</p>}
          </div>
          <small className="muted">Fetched {fmtDate(overview.fetchedAt)} · reads account, service lines, terminals, data usage, billing, addresses, products and optional data pools. Some resources require separate Starlink permissions.</small>
        </>}
      </div>}
    </Card>
  );
}

/* ----------------------------- users (RBAC) ----------------------------- */
function UsersPage({ me, reloadKey }: { me: Me; reloadKey: number }) {
  const [users, setUsers] = useState<any[]>([]);
  const [f, setF] = useState({ username: '', password: '', role: 'viewer', ownerName: '' });

  const load = useCallback(async () => { const r = await api.get('/users'); setUsers(r.data); }, [reloadKey]);
  useEffect(() => { if (me.role === 'admin') load(); }, [me.role, load]);

  const submit = async (e: any) => {
    e.preventDefault();
    await api.post('/users', f);
    setF({ username: '', password: '', role: 'viewer', ownerName: '' });
    toast('User created');
    load();
  };
  const setRole = async (id: number, role: string) => { await api.patch(`/users/${id}`, { role }); toast('Role updated'); load(); };
  const toggle = async (id: number, active: boolean) => { await api.patch(`/users/${id}`, { active }); toast('User updated'); load(); };
  const del = async (id: number) => { if (!confirm('Remove this user?')) return; await api.delete(`/users/${id}`); toast('User removed'); load(); };

  if (me.role !== 'admin') return <Card><h3>Users</h3><p className="muted">Only administrators can manage users.</p></Card>;

  return (
    <Card title="User Access (RBAC)" right={<span className="muted">admin &gt; operator &gt; viewer</span>}>
      <form className="formGrid" onSubmit={submit}>
        <label>Username<input required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <label>Password<input required type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="min 6 chars" /></label>
        <label>Role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">admin</option><option value="operator">operator</option><option value="viewer">viewer</option></select></label>
        <label>Display name<input value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} placeholder="e.g. Ops Team" /></label>
        <div className="actions"><button className="primary" type="submit">Create User</button></div>
      </form>
      <div className="tableHead" style={{ marginTop: 8 }}><span className="muted">{users.length} users</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Name</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.username}</b></td>
                <td>{u.ownerName || '—'}</td>
                <td>
                  <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
                    <option value="admin">admin</option><option value="operator">operator</option><option value="viewer">viewer</option>
                  </select>
                </td>
                <td>{u.active ? <span className="ok">active</span> : <span className="bad">disabled</span>}</td>
                <td className="row">
                  <button className="ghost" onClick={() => toggle(u.id, !u.active)}>{u.active ? 'Disable' : 'Enable'}</button>
                  <button className="ghost danger" onClick={() => del(u.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------- settings ----------------------------- */
function SettingsPage({ me }: { me: Me }) {
  const [pw, setPw] = useState('');
  const [cpw, setCpw] = useState('');
  const [msg, setMsg] = useState('');
  const changePw = async (e: any) => {
    e.preventDefault();
    if (pw !== cpw) { setMsg('Passwords do not match'); return; }
    try { await api.post('/auth/me/password', { password: pw }); setMsg('Password changed'); setPw(''); setCpw(''); }
    catch { setMsg('Failed to change password'); }
  };
  return (
    <div className="grid">
      <Card title="Profile">
        <p><b>User:</b> {me.username}</p>
        <p><b>Role:</b> <span className="pill2">{me.role}</span></p>
        <p className="muted">Credentials are kept on the backend; Starlink client secrets are encrypted at rest (AES-256-GCM).</p>
      </Card>
      <Card title="Change Password">
        <form className="formGrid" onSubmit={changePw}>
          <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min 6 chars" /></label>
          <label>Confirm<input type="password" value={cpw} onChange={(e) => setCpw(e.target.value)} /></label>
          <div className="actions"><button className="primary" type="submit">Update</button></div>
        </form>
        {msg && <small>{msg}</small>}
      </Card>
    </div>
  );
}

/* ----------------------------- shell ----------------------------- */
const NAV = [
  { id: 'Dashboard', icon: '◈' },
  { id: 'Starlink Sites', icon: '⌁' },
  { id: 'Usage & Analytics', icon: '▥' },
  { id: 'API Accounts', icon: '◎' },
  { id: 'Users', icon: '👥' },
  { id: 'Settings', icon: '⚙' },
];

export default function App() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(() => {
    const t = localStorage.getItem('token');
    const m = localStorage.getItem('me');
    if (!t || !m) return null;
    try { return JSON.parse(m); } catch { localStorage.removeItem('token'); localStorage.removeItem('me'); return null; }
  });
  const [page, setPage] = useState('Dashboard');
  const [reload, setReload] = useState(0);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light');

  // Apply the active theme to the document root so CSS variables resolve everywhere.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const doRefresh = async () => {
    if (!me || me.role === 'viewer') return;
    try {
      const r = await api.post('/sites/refresh');
      const refreshed = (r.data.results || []).filter((x: any) => x.ok).length;
      const failed = (r.data.results || []).filter((x: any) => !x.ok);
      if (failed.length) {
        const first = failed[0];
        toast(`Refreshed ${refreshed} site(s); ${failed.length} failed — ${first.name}: ${first.error}`);
      } else if (refreshed === 0) {
        toast('No linked sites to refresh — add a Starlink API Account + service line to a site');
      } else {
        toast(`Refreshed ${refreshed} site(s) from Starlink V2`);
      }
    } catch (e: any) {
      toast(`Refresh failed: ${e?.response?.data?.message || e?.message || 'error'}`);
    }
    setReload((r) => r + 1);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('me');
    setMe(null);
    nav('/login');
  };

  // Auto-refresh: pull live Starlink V2 data on load and on an interval so the
  // command center stays current without manual clicking. Only linked sites are
  // fetched (using their API Account client Id/secret); unlinked sites are skipped.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const run = async () => {
      try {
        await api.post('/sites/refresh');
      } catch {
        /* network/permission errors are surfaced via the per-site badge, not here */
      }
      if (!cancelled) setReload((r) => r + 1);
    };
    run();
    const timer = setInterval(run, 60000); // refresh every 60s
    return () => { cancelled = true; clearInterval(timer); };
  }, [me?.role]);

  if (!me) return <Login onAuth={setMe} />;

  return (
    <div className="shell">
      <aside>
        <div className="sideBrand"><span className="brandStar">✦</span><span className="brandWord">Starlink Hub</span></div>
        <div className="sideSub">Central IT Monitoring</div>
        {NAV.filter((n) => !(n.id === 'Users' && me.role !== 'admin')).map((n) => (
          <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => setPage(n.id)} aria-label={n.id}><span className="navIcon">{n.icon}</span><span className="navLabel">{n.id}</span></button>
        ))}
        <button className="logout" onClick={logout} aria-label="Logout"><span className="logoutIcon">↪</span><span className="logoutLabel">Logout</span></button>
        <SystemStatus reloadKey={reload} />
      </aside>
      <main>
        <header>
          <div><h1>{page}</h1><p>Central IT Monitoring</p></div>
          <div className="top-actions">
            <button className="icon-btn theme-toggle" onClick={toggleTheme} title="Toggle light/dark theme">{theme === 'dark' ? '☀ Light' : '🌙 Dark'}</button>
            {me.role !== 'viewer' && <button className="icon-btn" onClick={doRefresh}>↻ Refresh</button>}
            <div className="user"><div className="avatar">{initial(me.ownerName || me.username)}</div><div>{me.ownerName || me.username}<br /><small className="pill2">{me.role}</small></div></div>
          </div>
        </header>
        {page === 'Dashboard' && <Dashboard me={me} reloadKey={reload} />}
        {page === 'Starlink Sites' && <SitesPage me={me} reloadKey={reload} />}
        {page === 'Usage & Analytics' && <AnalyticsPage me={me} reloadKey={reload} />}
        {page === 'API Accounts' && <AccountsPage me={me} reloadKey={reload} />}
        {page === 'Users' && <UsersPage me={me} reloadKey={reload} />}
        {page === 'Settings' && <SettingsPage me={me} />}
      </main>
      <div id="toast" className="toast" />
    </div>
  );
}
