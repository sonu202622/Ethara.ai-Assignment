// Dashboard page JS
async function loadDashboard() {
  const user = getUser();
  if (user) document.getElementById('welcomeTitle').textContent = `Welcome back, ${user.name.split(' ')[0]} 👋`;

  const data = await api('/dashboard');
  if (!data.success) return showToast('Failed to load dashboard', 'error');

  const { taskStats, projectStats, myTasks, overdueTasks, recentActivity, teamStats, tasksByPriority } = data.data;

  // Render stats
  const overdueCount = taskStats.overdue || 0;
  const overdueNavBadge = document.getElementById('overdueNavBadge');
  if (overdueCount > 0) { overdueNavBadge.textContent = overdueCount; overdueNavBadge.style.display = ''; }

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon primary">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
      </div>
      <div class="stat-label">Total Tasks</div>
      <div class="stat-value">${taskStats.total || 0}</div>
      <div class="stat-trend">${taskStats.in_progress || 0} in progress</div>
    </div>
    <div class="stat-card success">
      <div class="stat-card-icon success">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
      </div>
      <div class="stat-label">Completed</div>
      <div class="stat-value">${taskStats.done || 0}</div>
      <div class="stat-trend">${taskStats.total > 0 ? Math.round((taskStats.done/taskStats.total)*100) : 0}% completion rate</div>
    </div>
    <div class="stat-card${overdueCount > 0 ? ' danger' : ' warning'}">
      <div class="stat-card-icon${overdueCount > 0 ? ' danger' : ' warning'}">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
      </div>
      <div class="stat-label">Overdue</div>
      <div class="stat-value">${overdueCount}</div>
      <div class="stat-trend">${taskStats.review || 0} awaiting review</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-card-icon accent">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
      </div>
      <div class="stat-label">Active Projects</div>
      <div class="stat-value">${projectStats.active || 0}</div>
      <div class="stat-trend">${projectStats.completed || 0} completed</div>
    </div>
  `;

  // My Tasks
  const myTasksList = document.getElementById('myTasksList');
  if (myTasks.length === 0) {
    myTasksList.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>All caught up!</h3><p>No pending tasks assigned to you.</p></div>`;
  } else {
    myTasksList.innerHTML = myTasks.map(t => `
      <div class="task-list-item" onclick="window.location.href='/tasks.html?id=${t.id}'">
        <div class="project-dot" style="background:${t.project_color||'#6366f1'}"></div>
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          ${priorityBadge(t.priority)}
          ${t.due_date ? `<span class="task-due${isOverdue(t.due_date,t.status)?' overdue':''}">${daysUntil(t.due_date)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Overdue Tasks
  const overdueList = document.getElementById('overdueTasksList');
  if (overdueTasks.length === 0) {
    overdueList.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><h3>No overdue tasks!</h3><p>Everything is on track.</p></div>`;
  } else {
    overdueList.innerHTML = overdueTasks.map(t => `
      <div class="task-list-item" onclick="window.location.href='/tasks.html?id=${t.id}'">
        <div class="project-dot" style="background:${t.project_color||'#6366f1'}"></div>
        <div style="flex:1;min-width:0">
          <div class="task-title">${t.title}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${t.project_name}${t.assignee_name?' · '+t.assignee_name:''}</div>
        </div>
        <span class="task-due overdue">${daysUntil(t.due_date)}</span>
      </div>
    `).join('');
  }

  // Activity Feed
  const activityFeed = document.getElementById('activityFeed');
  const activityIcons = { PROJECT_CREATED:'🚀', PROJECT_UPDATED:'✏️', PROJECT_DELETED:'🗑️', TASK_CREATED:'📋', TASK_UPDATED:'🔄', TASK_STATUS_CHANGED:'⚡', TASK_DELETED:'🗑️', MEMBER_ADDED:'👤', MEMBER_REMOVED:'👥', USER_REGISTERED:'🎉', USER_LOGIN:'🔑' };
  if (recentActivity.length === 0) {
    activityFeed.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No activity yet</h3></div>`;
  } else {
    activityFeed.innerHTML = recentActivity.map(a => {
      const label = a.action.replace(/_/g,' ').toLowerCase().replace(/^\w/,c=>c.toUpperCase());
      const when = new Date(a.created_at);
      const timeAgo = formatTimeAgo(when);
      return `
        <div class="activity-item">
          <div class="activity-icon">${activityIcons[a.action]||'📌'}</div>
          <div class="activity-content">
            <div class="activity-text"><strong>${a.user_name||'System'}</strong> — ${label}</div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Project Progress
  const projectProgress = document.getElementById('projectProgress');
  const projectsData = await api('/projects');
  if (projectsData.success && projectsData.data.projects.length > 0) {
    projectProgress.innerHTML = projectsData.data.projects.slice(0, 5).map(p => {
      const pct = p.task_count > 0 ? Math.round((p.completed_tasks / p.task_count) * 100) : 0;
      return `
        <div class="task-list-item" onclick="window.location.href='/projects.html?id=${p.id}'" style="flex-direction:column;align-items:stretch;gap:8px;cursor:pointer">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="project-dot" style="width:10px;height:10px;background:${p.color||'#6366f1'}"></div>
              <span style="font-size:0.875rem;font-weight:600">${p.name}</span>
            </div>
            <span style="font-size:0.8rem;color:var(--text3)">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:0.75rem;color:var(--text3)">${p.completed_tasks||0} / ${p.task_count||0} tasks done</div>
        </div>
      `;
    }).join('');
  } else {
    projectProgress.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><h3>No projects yet</h3><p><a href="/projects.html" style="color:var(--primary)">Create your first project →</a></p></div>`;
  }

  // Team stats (admin only)
  const user2 = getUser();
  if (user2?.role === 'admin' && teamStats) {
    document.getElementById('teamStatsCard').style.display = '';
    document.getElementById('teamTableBody').innerHTML = teamStats.map(m => {
      const pct = m.assigned_tasks > 0 ? Math.round((m.completed_tasks / m.assigned_tasks) * 100) : 0;
      return `
        <tr>
          <td><div class="user-cell">${makeAvatar(m.name,'avatar-sm')} <div><div style="font-weight:600;font-size:0.875rem">${m.name}</div><div style="font-size:0.75rem;color:var(--text3)">${m.email}</div></div></div></td>
          <td>${m.role === 'admin' ? '<span class="badge-role admin">Admin</span>' : '<span class="badge-role member">Member</span>'}</td>
          <td style="font-weight:600">${m.assigned_tasks||0}</td>
          <td style="color:#34d399;font-weight:600">${m.completed_tasks||0}</td>
          <td style="width:120px"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('dashboardGrid').style.display = '';
}

function formatTimeAgo(date) {
  const secs = Math.floor((new Date() - date) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

function openProfileModal() {
  const user = getUser();
  openModal(`
    <div class="modal-header">
      <h3>Profile Settings</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;justify-content:center">${makeAvatar(user.name,'avatar-lg')}</div>
      <div class="form-group input-no-icon">
        <label>Full Name</label>
        <div class="input-wrapper"><input id="profileName" value="${user.name}" /></div>
      </div>
      <div class="form-group input-no-icon">
        <label>Email</label>
        <div class="input-wrapper"><input value="${user.email}" disabled style="opacity:0.6" /></div>
      </div>
      <div class="form-group input-no-icon">
        <label>Role</label>
        <div class="input-wrapper"><input value="${user.role === 'admin' ? 'Administrator' : 'Member'}" disabled style="opacity:0.6" /></div>
      </div>
      <div style="border-top:1px solid var(--border2);padding-top:16px">
        <h4 style="margin-bottom:12px;font-size:0.875rem">Change Password</h4>
        <div class="modal-body" style="gap:12px">
          <div class="form-group input-no-icon">
            <label>Current Password</label>
            <div class="input-wrapper"><input type="password" id="currentPwd" placeholder="••••••••" /></div>
          </div>
          <div class="form-group input-no-icon">
            <label>New Password</label>
            <div class="input-wrapper"><input type="password" id="newPwd" placeholder="Min 6 characters" /></div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveProfile()">Save Changes</button>
    </div>
  `);
}

async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const currentPwd = document.getElementById('currentPwd').value;
  const newPwd = document.getElementById('newPwd').value;

  if (name) {
    const res = await api('/auth/profile', { method: 'PUT', body: JSON.stringify({ name }) });
    if (res.success) { setUser(res.data.user); renderUserCard(); showToast('Profile updated!', 'success'); }
  }
  if (currentPwd && newPwd) {
    const res = await api('/auth/change-password', { method: 'PUT', body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
    if (res.success) showToast('Password changed!', 'success');
    else showToast(res.message, 'error');
  }
  closeModal();
}

loadDashboard();
