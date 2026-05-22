let allProjects = [];
const PROJECT_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6'];

async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = `<div class="skeleton" style="height:240px;border-radius:12px"></div>`.repeat(3);
  const data = await api('/projects');
  if (!data.success) return showToast('Failed to load projects', 'error');
  allProjects = data.data.projects;
  renderProjects(allProjects);

  // Open project detail if ?id= in URL
  const urlId = new URLSearchParams(location.search).get('id');
  if (urlId) openProjectDetail(parseInt(urlId));
}

function renderProjects(projects) {
  const grid = document.getElementById('projectsGrid');
  if (projects.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📁</div><h3>No projects found</h3><p>Create your first project to get started.</p><button class="btn-primary" onclick="openCreateProjectModal()">Create Project</button></div>`;
    return;
  }
  const user = getUser();
  grid.innerHTML = projects.map(p => {
    const pct = p.task_count > 0 ? Math.round((p.completed_tasks/p.task_count)*100) : 0;
    const statusColors = {active:'#34d399',completed:'#818cf8',on_hold:'#fbbf24',archived:'#64748b'};
    const statusLabels = {active:'Active',completed:'Completed',on_hold:'On Hold',archived:'Archived'};
    const isOwner = p.owner_id === user?.id || user?.role === 'admin';
    return `
      <div class="project-card" onclick="openProjectDetail(${p.id})" style="--proj-color:${p.color||'#6366f1'}">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${p.color||'#6366f1'};border-radius:12px 12px 0 0"></div>
        <div class="project-card-header">
          <div class="project-icon" style="background:${p.color||'#6366f1'}22;color:${p.color||'#6366f1'};font-size:1.5rem">${p.name[0].toUpperCase()}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;background:${statusColors[p.status]}22;color:${statusColors[p.status]};border:1px solid ${statusColors[p.status]}44">${statusLabels[p.status]}</span>
            ${priorityBadge(p.priority)}
          </div>
        </div>
        <div class="project-name" style="margin-top:12px">${p.name}</div>
        <div class="project-desc">${p.description||'No description provided.'}</div>
        <div class="project-stats">
          <div class="proj-stat"><div class="proj-stat-val">${p.task_count||0}</div><div class="proj-stat-lbl">Tasks</div></div>
          <div class="proj-stat"><div class="proj-stat-val" style="color:#34d399">${p.completed_tasks||0}</div><div class="proj-stat-lbl">Done</div></div>
          <div class="proj-stat"><div class="proj-stat-val">${p.member_count||0}</div><div class="proj-stat-lbl">Members</div></div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${p.color||'#6366f1'}"></div></div>
        <div class="project-footer">
          <div style="font-size:0.75rem;color:var(--text3)">${p.due_date ? 'Due '+formatDate(p.due_date) : 'No due date'}</div>
          <div style="display:flex;gap:8px;align-items:center">
            ${isOwner ? `
              <button class="btn-icon" onclick="event.stopPropagation();openEditProjectModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              </button>
              <button class="btn-icon" style="color:var(--danger)" onclick="event.stopPropagation();deleteProject(${p.id},'${p.name.replace(/'/g,"\\'")}')">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjects() {
  const q = document.getElementById('searchProjects').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  renderProjects(allProjects.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)) &&
    (!status || p.status === status)
  ));
}

function openCreateProjectModal() {
  openModal(`
    <div class="modal-header"><h3>Create New Project</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <form class="modal-body" onsubmit="submitProject(event)">
      <div class="form-group input-no-icon">
        <label>Project Name *</label>
        <div class="input-wrapper"><input id="projName" placeholder="e.g. Website Redesign" required /></div>
      </div>
      <div class="form-group input-no-icon">
        <label>Description</label>
        <div class="input-wrapper"><textarea id="projDesc" placeholder="What is this project about?" rows="3"></textarea></div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon">
          <label>Status</label>
          <div class="input-wrapper"><select id="projStatus"><option value="active">Active</option><option value="on_hold">On Hold</option><option value="completed">Completed</option><option value="archived">Archived</option></select></div>
        </div>
        <div class="form-group input-no-icon">
          <label>Priority</label>
          <div class="input-wrapper"><select id="projPriority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon">
          <label>Start Date</label>
          <div class="input-wrapper"><input type="date" id="projStart" /></div>
        </div>
        <div class="form-group input-no-icon">
          <label>Due Date</label>
          <div class="input-wrapper"><input type="date" id="projDue" /></div>
        </div>
      </div>
      <div class="form-group input-no-icon">
        <label>Color</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${PROJECT_COLORS.map(c => `<div onclick="selectColor('${c}')" id="clr_${c.slice(1)}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;transition:all 0.2s" title="${c}"></div>`).join('')}
        </div>
        <input type="hidden" id="projColor" value="#6366f1" />
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create Project</button>
      </div>
    </form>
  `);
  selectColor('#6366f1');
}

function selectColor(color) {
  document.getElementById('projColor').value = color;
  PROJECT_COLORS.forEach(c => {
    const el = document.getElementById(`clr_${c.slice(1)}`);
    if (el) el.style.border = c === color ? `3px solid white` : '3px solid transparent';
  });
}

function openEditProjectModal(p) {
  openModal(`
    <div class="modal-header"><h3>Edit Project</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <form class="modal-body" onsubmit="submitEditProject(event,${p.id})">
      <div class="form-group input-no-icon"><label>Project Name *</label><div class="input-wrapper"><input id="projName" value="${p.name}" required /></div></div>
      <div class="form-group input-no-icon"><label>Description</label><div class="input-wrapper"><textarea id="projDesc" rows="3">${p.description||''}</textarea></div></div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Status</label><div class="input-wrapper"><select id="projStatus"><option value="active" ${p.status==='active'?'selected':''}>Active</option><option value="on_hold" ${p.status==='on_hold'?'selected':''}>On Hold</option><option value="completed" ${p.status==='completed'?'selected':''}>Completed</option><option value="archived" ${p.status==='archived'?'selected':''}>Archived</option></select></div></div>
        <div class="form-group input-no-icon"><label>Priority</label><div class="input-wrapper"><select id="projPriority"><option value="low" ${p.priority==='low'?'selected':''}>Low</option><option value="medium" ${p.priority==='medium'?'selected':''}>Medium</option><option value="high" ${p.priority==='high'?'selected':''}>High</option><option value="critical" ${p.priority==='critical'?'selected':''}>Critical</option></select></div></div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Start Date</label><div class="input-wrapper"><input type="date" id="projStart" value="${p.start_date||''}" /></div></div>
        <div class="form-group input-no-icon"><label>Due Date</label><div class="input-wrapper"><input type="date" id="projDue" value="${p.due_date||''}" /></div></div>
      </div>
      <div class="form-group input-no-icon">
        <label>Color</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${PROJECT_COLORS.map(c=>`<div onclick="selectColor('${c}')" id="clr_${c.slice(1)}" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid transparent;transition:all 0.2s"></div>`).join('')}</div>
        <input type="hidden" id="projColor" value="${p.color||'#6366f1'}" />
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `);
  selectColor(p.color || '#6366f1');
}

async function submitProject(e) {
  e.preventDefault();
  const res = await api('/projects', { method:'POST', body: JSON.stringify({
    name: document.getElementById('projName').value,
    description: document.getElementById('projDesc').value,
    status: document.getElementById('projStatus').value,
    priority: document.getElementById('projPriority').value,
    start_date: document.getElementById('projStart').value || null,
    due_date: document.getElementById('projDue').value || null,
    color: document.getElementById('projColor').value
  })});
  if (res.success) { closeModal(); showToast('Project created!', 'success'); loadProjects(); }
  else showToast(res.message || (res.errors?.[0]?.msg) || 'Error', 'error');
}

async function submitEditProject(e, id) {
  e.preventDefault();
  const res = await api(`/projects/${id}`, { method:'PUT', body: JSON.stringify({
    name: document.getElementById('projName').value,
    description: document.getElementById('projDesc').value,
    status: document.getElementById('projStatus').value,
    priority: document.getElementById('projPriority').value,
    start_date: document.getElementById('projStart').value || null,
    due_date: document.getElementById('projDue').value || null,
    color: document.getElementById('projColor').value
  })});
  if (res.success) { closeModal(); showToast('Project updated!', 'success'); loadProjects(); }
  else showToast(res.message || 'Error', 'error');
}

async function deleteProject(id, name) {
  if (!confirm(`Delete project "${name}"? This will remove all tasks.`)) return;
  const res = await api(`/projects/${id}`, { method:'DELETE' });
  if (res.success) { showToast('Project deleted', 'info'); loadProjects(); }
  else showToast(res.message, 'error');
}

async function openProjectDetail(id) {
  const data = await api(`/projects/${id}`);
  if (!data.success) return showToast('Project not found', 'error');
  const { project: p, members } = data.data;
  const user = getUser();
  const isAdmin = user?.role === 'admin';

  const tasksData = await api(`/tasks?project_id=${id}`);
  const tasks = tasksData.success ? tasksData.data.tasks : [];
  const allUsers = isAdmin ? (await api('/auth/users')).data?.users || [] : [];

  const kanbanCols = ['todo','in_progress','review','done'];
  const colLabels = {todo:'To Do',in_progress:'In Progress',review:'Review',done:'Done'};
  const colDots = {todo:'#64748b',in_progress:'#818cf8',review:'#fbbf24',done:'#34d399'};

  openModal(`
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:${p.color||'#6366f1'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#fff">${p.name[0]}</div>
        <div>
          <h3 style="margin:0">${p.name}</h3>
          <div style="font-size:0.8rem;color:var(--text3)">${p.description||''}</div>
        </div>
      </div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body" style="max-height:65vh;overflow-y:auto">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px">
        <div><div class="meta-label">Status</div><div class="meta-value">${p.status}</div></div>
        <div><div class="meta-label">Priority</div><div>${priorityBadge(p.priority)}</div></div>
        <div><div class="meta-label">Due Date</div><div class="meta-value">${formatDate(p.due_date)}</div></div>
        <div><div class="meta-label">Owner</div><div class="meta-value">${p.owner_name}</div></div>
      </div>

      <h4 style="margin-bottom:12px;font-size:0.875rem">Team Members (${members.length})</h4>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        ${members.map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:8px">${makeAvatar(m.name,'avatar-sm')}<div><div style="font-size:0.8rem;font-weight:600">${m.name}</div><span class="badge-role ${m.role}">${m.role}</span></div>${isAdmin&&m.user_id!==p.owner_id?`<button class="btn-icon" style="width:24px;height:24px" onclick="removeMember(${id},${m.id})"><svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>`:''}</div>`).join('')}
        ${isAdmin?`<button class="btn-secondary" style="font-size:0.8rem;padding:8px 12px" onclick="openAddMemberModal(${id},${JSON.stringify(allUsers).replace(/"/g,'&quot;')})">+ Add Member</button>`:''}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h4 style="font-size:0.875rem">Tasks (${tasks.length})</h4>
        <button class="btn-primary" style="padding:6px 12px;font-size:0.8rem" onclick="closeModal();window.location.href='/tasks.html?project_id=${id}'">Manage Tasks</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${kanbanCols.map(col=>{
          const colTasks = tasks.filter(t=>t.status===col);
          return `<div style="background:var(--surface2);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:0.8rem;font-weight:700">
              <div style="width:8px;height:8px;border-radius:50%;background:${colDots[col]}"></div>${colLabels[col]}
              <span style="margin-left:auto;background:var(--surface3);padding:2px 6px;border-radius:999px;font-size:0.7rem">${colTasks.length}</span>
            </div>
            ${colTasks.slice(0,4).map(t=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;font-size:0.8rem;cursor:pointer" onclick="closeModal();window.location.href='/tasks.html?id=${t.id}'">${t.title}</div>`).join('')}
            ${colTasks.length>4?`<div style="font-size:0.75rem;color:var(--text3);text-align:center">+${colTasks.length-4} more</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `, 'projectDetailModal');
}

async function removeMember(projectId, userId) {
  if (!confirm('Remove this member from the project?')) return;
  const res = await api(`/projects/${projectId}/members/${userId}`, { method:'DELETE' });
  if (res.success) { closeModal('projectDetailModal'); showToast('Member removed', 'info'); openProjectDetail(projectId); }
  else showToast(res.message, 'error');
}

function openAddMemberModal(projectId, users) {
  openModal(`
    <div class="modal-header"><h3>Add Team Member</h3><button class="modal-close" onclick="closeModal('addMemberModal')">×</button></div>
    <div class="modal-body">
      <div class="form-group input-no-icon">
        <label>Select User</label>
        <div class="input-wrapper"><select id="addUserId">${users.map(u=>`<option value="${u.id}">${u.name} (${u.email}) — ${u.role}</option>`).join('')}</select></div>
      </div>
      <div class="form-group input-no-icon">
        <label>Project Role</label>
        <div class="input-wrapper"><select id="addMemberRole"><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal('addMemberModal')">Cancel</button>
      <button class="btn-primary" onclick="submitAddMember(${projectId})">Add Member</button>
    </div>
  `, 'addMemberModal');
}

async function submitAddMember(projectId) {
  const user_id = document.getElementById('addUserId').value;
  const role = document.getElementById('addMemberRole').value;
  const res = await api(`/projects/${projectId}/members`, { method:'POST', body: JSON.stringify({ user_id: parseInt(user_id), role }) });
  if (res.success) { closeModal('addMemberModal'); showToast(res.message, 'success'); openProjectDetail(projectId); }
  else showToast(res.message, 'error');
}

loadProjects();
