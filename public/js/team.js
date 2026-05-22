async function loadTeam() {
  const user = getUser();
  if (user?.role !== 'admin') {
    document.querySelector('.page-body').innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><h3>Admin Access Required</h3><p>Only administrators can view the team management page.</p><a href="/dashboard.html" class="btn-primary">Go to Dashboard</a></div>`;
    return;
  }

  const data = await api('/dashboard');
  if (!data.success) return showToast('Failed to load team data', 'error');
  const { teamStats, taskStats, projectStats } = data.data;

  // Stats
  const totalMembers = teamStats?.length || 0;
  const admins = teamStats?.filter(m => m.role === 'admin').length || 0;
  const activeWorkers = teamStats?.filter(m => m.assigned_tasks > 0).length || 0;

  document.getElementById('teamStatsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon primary"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg></div>
      <div class="stat-label">Total Members</div>
      <div class="stat-value">${totalMembers}</div>
      <div class="stat-trend">${admins} admin${admins!==1?'s':''}</div>
    </div>
    <div class="stat-card success">
      <div class="stat-card-icon success"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>
      <div class="stat-label">Active Workers</div>
      <div class="stat-value">${activeWorkers}</div>
      <div class="stat-trend">With assigned tasks</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-card-icon warning"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg></div>
      <div class="stat-label">Total Tasks</div>
      <div class="stat-value">${taskStats?.total || 0}</div>
      <div class="stat-trend">${taskStats?.done || 0} completed</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-card-icon accent"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg></div>
      <div class="stat-label">Projects</div>
      <div class="stat-value">${projectStats?.total || 0}</div>
      <div class="stat-trend">${projectStats?.active || 0} active</div>
    </div>
  `;

  // Table
  const tbody = document.getElementById('teamTableBody');
  if (!teamStats || teamStats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">No team members found.</td></tr>`;
    return;
  }

  tbody.innerHTML = teamStats.map(m => {
    const pct = m.assigned_tasks > 0 ? Math.round((m.completed_tasks / m.assigned_tasks) * 100) : 0;
    return `
      <tr>
        <td>
          <div class="user-cell">
            ${makeAvatar(m.name)}
            <div>
              <div style="font-weight:600;font-size:0.875rem">${m.name}</div>
              <div style="font-size:0.75rem;color:var(--text3)">${m.email}</div>
            </div>
          </div>
        </td>
        <td>${m.role === 'admin' ? '<span class="badge-role admin">Admin</span>' : '<span class="badge-role member">Member</span>'}</td>
        <td><span style="font-weight:600;font-size:1rem">${m.assigned_tasks || 0}</span></td>
        <td><span style="font-weight:600;font-size:1rem;color:#34d399">${m.completed_tasks || 0}</span></td>
        <td style="width:160px">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${pct}%"></div></div>
            <span style="font-size:0.75rem;color:var(--text3);width:32px">${pct}%</span>
          </div>
        </td>
        <td style="font-size:0.813rem;color:var(--text3)">${new Date(m.created_at||Date.now()).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</td>
      </tr>
    `;
  }).join('');
}

loadTeam();
