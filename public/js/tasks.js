let allTasks = [], allProjects = [], allUsers = [], currentView = 'list';
const KANBAN_COLS = ['todo','in_progress','review','done'];
const COL_LABELS = {todo:'To Do',in_progress:'In Progress',review:'Review',done:'Done'};
const COL_COLORS = {todo:'#64748b',in_progress:'#818cf8',review:'#fbbf24',done:'#34d399'};

async function init() {
  const user = getUser();
  const [tasksRes, projectsRes, usersRes] = await Promise.all([
    api('/tasks'), api('/projects'),
    user?.role === 'admin' ? api('/auth/users') : Promise.resolve({ success: true, data: { users: [] } })
  ]);
  allTasks = tasksRes.success ? tasksRes.data.tasks : [];
  allProjects = projectsRes.success ? projectsRes.data.projects : [];
  allUsers = usersRes.success ? usersRes.data.users : [];

  // Populate project filter
  const projFilter = document.getElementById('filterProject');
  allProjects.forEach(p => { projFilter.innerHTML += `<option value="${p.id}">${p.name}</option>`; });

  // URL params
  const params = new URLSearchParams(location.search);
  if (params.get('project_id')) projFilter.value = params.get('project_id');
  if (params.get('new')) { setTimeout(openCreateTaskModal, 200); }
  if (params.get('id')) { setTimeout(() => openTaskDetail(parseInt(params.get('id'))), 200); }

  filterTasks();
  setView('list');
}

function filterTasks() {
  const q = document.getElementById('searchTasks').value.toLowerCase();
  const pId = document.getElementById('filterProject').value;
  const status = document.getElementById('filterStatus').value;
  const priority = document.getElementById('filterPriority').value;
  const overdue = document.getElementById('filterOverdue').checked;

  const filtered = allTasks.filter(t => {
    if (q && !t.title.toLowerCase().includes(q) && !(t.description||'').toLowerCase().includes(q)) return false;
    if (pId && t.project_id != pId) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (overdue && !isOverdue(t.due_date, t.status)) return false;
    return true;
  });

  if (currentView === 'list') renderListView(filtered);
  else renderKanbanView(filtered);
}

function setView(view) {
  currentView = view;
  document.getElementById('listView').style.display = view === 'list' ? '' : 'none';
  document.getElementById('kanbanView').style.display = view === 'kanban' ? '' : 'none';
  document.getElementById('viewList').classList.toggle('btn-primary', view==='list');
  document.getElementById('viewList').classList.toggle('btn-secondary', view!=='list');
  document.getElementById('viewKanban').classList.toggle('btn-primary', view==='kanban');
  document.getElementById('viewKanban').classList.toggle('btn-secondary', view!=='kanban');
  filterTasks();
}

function renderListView(tasks) {
  const body = document.getElementById('taskListBody');
  if (tasks.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No tasks found</h3><p>Create a new task or adjust your filters.</p><button class="btn-primary" onclick="openCreateTaskModal()">Create Task</button></div>`;
    return;
  }
  body.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Task</th>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Project</th>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Status</th>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Priority</th>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Assignee</th>
        <th style="padding:12px 20px;text-align:left;font-size:0.75rem;color:var(--text3);border-bottom:1px solid var(--border2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Due Date</th>
        <th style="padding:12px 20px;border-bottom:1px solid var(--border2)"></th>
      </tr></thead>
      <tbody>${tasks.map(t => `
        <tr style="cursor:pointer;transition:background 0.15s" onclick="openTaskDetail(${t.id})" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            <div style="font-weight:600;font-size:0.875rem;margin-bottom:2px">${t.title}</div>
            ${t.description ? `<div style="font-size:0.75rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">${t.description}</div>` : ''}
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:8px;height:8px;border-radius:50%;background:${t.project_color||'#6366f1'}"></div>
              <span style="font-size:0.813rem;color:var(--text2)">${t.project_name}</span>
            </div>
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            <select onchange="quickUpdateStatus(${t.id},this.value)" onclick="event.stopPropagation()" style="padding:4px 8px;font-size:0.78rem;border-radius:6px;background:var(--surface2);border:1px solid var(--border);color:var(--text)">
              ${KANBAN_COLS.map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${COL_LABELS[s]}</option>`).join('')}
            </select>
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">${priorityBadge(t.priority)}</td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            ${t.assignee_name ? `<div style="display:flex;align-items:center;gap:6px">${makeAvatar(t.assignee_name,'avatar-sm')}<span style="font-size:0.8rem">${t.assignee_name}</span></div>` : '<span style="color:var(--text3);font-size:0.8rem">Unassigned</span>'}
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            <span style="font-size:0.8rem${isOverdue(t.due_date,t.status)?';color:var(--danger);font-weight:600':';color:var(--text3)'}">${t.due_date ? daysUntil(t.due_date) : '—'}</span>
          </td>
          <td style="padding:14px 20px;border-bottom:1px solid var(--border2)">
            <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="openEditTaskModal(${t.id})"><svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg></button>
              <button class="btn-icon" style="color:var(--danger)" onclick="deleteTask(${t.id},'${t.title.replace(/'/g,"\\'")}')"><svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></button>
            </div>
          </td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
}

function renderKanbanView(tasks) {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = KANBAN_COLS.map(col => {
    const colTasks = tasks.filter(t => t.status === col);
    return `
      <div class="kanban-column">
        <div class="kanban-col-header">
          <div class="kanban-col-title"><div style="width:10px;height:10px;border-radius:50%;background:${COL_COLORS[col]}"></div>${COL_LABELS[col]}</div>
          <span class="kanban-count">${colTasks.length}</span>
        </div>
        <div class="kanban-cards" id="col_${col}">
          ${colTasks.map(t => `
            <div class="kanban-card" onclick="openTaskDetail(${t.id})">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                ${priorityBadge(t.priority)}
                <div onclick="event.stopPropagation()">
                  <button class="btn-ghost" style="padding:2px 6px" onclick="openEditTaskModal(${t.id})">✏️</button>
                </div>
              </div>
              <div class="kanban-card-title">${t.title}</div>
              ${t.tags && t.tags !== '[]' ? `<div class="kanban-card-tags">${JSON.parse(t.tags||'[]').map(tag=>`<span class="tag">#${tag}</span>`).join('')}</div>` : ''}
              <div class="kanban-card-footer">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:8px;height:8px;border-radius:50%;background:${t.project_color||'#6366f1'}"></div>
                  <span style="font-size:0.72rem;color:var(--text3)">${t.project_name}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                  ${t.assignee_name ? makeAvatar(t.assignee_name,'avatar-sm') : ''}
                  ${t.due_date ? `<span style="font-size:0.72rem${isOverdue(t.due_date,t.status)?';color:var(--danger)':';color:var(--text3)'}">${daysUntil(t.due_date)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
          ${colTasks.length === 0 ? `<div style="padding:20px;text-align:center;font-size:0.8rem;color:var(--text3);border:1px dashed var(--border);border-radius:8px">Drop tasks here</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function quickUpdateStatus(taskId, status) {
  await api(`/tasks/${taskId}/status`, { method:'PATCH', body: JSON.stringify({ status }) });
  const task = allTasks.find(t => t.id === taskId);
  if (task) { task.status = status; filterTasks(); }
}

function openCreateTaskModal() {
  const user = getUser();
  openModal(`
    <div class="modal-header"><h3>Create New Task</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <form class="modal-body" onsubmit="submitTask(event)">
      <div class="form-group input-no-icon"><label>Task Title *</label><div class="input-wrapper"><input id="taskTitle" placeholder="What needs to be done?" required /></div></div>
      <div class="form-group input-no-icon"><label>Description</label><div class="input-wrapper"><textarea id="taskDesc" placeholder="Add more details..." rows="3"></textarea></div></div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Project *</label><div class="input-wrapper"><select id="taskProject" required><option value="">Select project</option>${allProjects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div></div>
        <div class="form-group input-no-icon"><label>Assignee</label><div class="input-wrapper"><select id="taskAssignee"><option value="">Unassigned</option>${allUsers.map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select></div></div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Status</label><div class="input-wrapper"><select id="taskStatus"><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option></select></div></div>
        <div class="form-group input-no-icon"><label>Priority</label><div class="input-wrapper"><select id="taskPriority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div></div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Due Date</label><div class="input-wrapper"><input type="date" id="taskDue" /></div></div>
        <div class="form-group input-no-icon"><label>Est. Hours</label><div class="input-wrapper"><input type="number" id="taskHours" placeholder="0" min="0" step="0.5" /></div></div>
      </div>
      <div class="form-group input-no-icon"><label>Tags (comma-separated)</label><div class="input-wrapper"><input id="taskTags" placeholder="frontend, backend, design" /></div></div>
      <div class="modal-footer" style="padding:0;margin-top:8px">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create Task</button>
      </div>
    </form>
  `);
  // Pre-select project from filter
  const fp = document.getElementById('filterProject').value;
  if (fp) document.getElementById('taskProject').value = fp;
}

async function submitTask(e) {
  e.preventDefault();
  const tags = document.getElementById('taskTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const res = await api('/tasks', { method:'POST', body: JSON.stringify({
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    project_id: parseInt(document.getElementById('taskProject').value),
    assignee_id: document.getElementById('taskAssignee').value ? parseInt(document.getElementById('taskAssignee').value) : null,
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    due_date: document.getElementById('taskDue').value || null,
    estimated_hours: document.getElementById('taskHours').value ? parseFloat(document.getElementById('taskHours').value) : null,
    tags
  })});
  if (res.success) { closeModal(); showToast('Task created!', 'success'); refreshTasks(); }
  else showToast(res.errors?.[0]?.msg || res.message || 'Error', 'error');
}

async function openEditTaskModal(taskId) {
  const data = await api(`/tasks/${taskId}`);
  if (!data.success) return;
  const t = data.data.task;
  const tags = JSON.parse(t.tags||'[]').join(', ');
  openModal(`
    <div class="modal-header"><h3>Edit Task</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <form class="modal-body" onsubmit="submitEditTask(event,${t.id})">
      <div class="form-group input-no-icon"><label>Task Title *</label><div class="input-wrapper"><input id="taskTitle" value="${t.title.replace(/"/g,'&quot;')}" required /></div></div>
      <div class="form-group input-no-icon"><label>Description</label><div class="input-wrapper"><textarea id="taskDesc" rows="3">${t.description||''}</textarea></div></div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Assignee</label><div class="input-wrapper"><select id="taskAssignee"><option value="">Unassigned</option>${allUsers.map(u=>`<option value="${u.id}" ${t.assignee_id==u.id?'selected':''}>${u.name}</option>`).join('')}</select></div></div>
        <div class="form-group input-no-icon"><label>Status</label><div class="input-wrapper"><select id="taskStatus">${KANBAN_COLS.map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${COL_LABELS[s]}</option>`).join('')}</select></div></div>
      </div>
      <div class="form-row">
        <div class="form-group input-no-icon"><label>Priority</label><div class="input-wrapper"><select id="taskPriority"><option value="low" ${t.priority==='low'?'selected':''}>Low</option><option value="medium" ${t.priority==='medium'?'selected':''}>Medium</option><option value="high" ${t.priority==='high'?'selected':''}>High</option><option value="critical" ${t.priority==='critical'?'selected':''}>Critical</option></select></div></div>
        <div class="form-group input-no-icon"><label>Due Date</label><div class="input-wrapper"><input type="date" id="taskDue" value="${t.due_date||''}" /></div></div>
      </div>
      <div class="form-group input-no-icon"><label>Tags</label><div class="input-wrapper"><input id="taskTags" value="${tags}" placeholder="frontend, backend" /></div></div>
      <div class="modal-footer" style="padding:0;margin-top:8px">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `);
}

async function submitEditTask(e, taskId) {
  e.preventDefault();
  const tags = document.getElementById('taskTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const res = await api(`/tasks/${taskId}`, { method:'PUT', body: JSON.stringify({
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    assignee_id: document.getElementById('taskAssignee').value ? parseInt(document.getElementById('taskAssignee').value) : null,
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    due_date: document.getElementById('taskDue').value || null,
    tags
  })});
  if (res.success) { closeModal(); showToast('Task updated!', 'success'); refreshTasks(); }
  else showToast(res.message || 'Error', 'error');
}

async function deleteTask(taskId, title) {
  if (!confirm(`Delete task "${title}"?`)) return;
  const res = await api(`/tasks/${taskId}`, { method:'DELETE' });
  if (res.success) { showToast('Task deleted', 'info'); refreshTasks(); closeTaskDetail(); }
  else showToast(res.message, 'error');
}

async function openTaskDetail(taskId) {
  const data = await api(`/tasks/${taskId}`);
  if (!data.success) return showToast('Task not found', 'error');
  const { task: t, comments } = data.data;
  const user = getUser();

  const panel = document.getElementById('taskDetailPanel');
  const overlay = document.getElementById('taskDetailOverlay');
  
  panel.innerHTML = `
    <div class="task-detail-header">
      <button class="btn-icon" onclick="closeTaskDetail()"><svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;color:var(--text3);display:flex;align-items:center;gap:6px">
          <div style="width:8px;height:8px;border-radius:50%;background:${t.project_color||'#6366f1'}"></div>${t.project_name}
        </div>
      </div>
      <button class="btn-secondary" style="padding:6px 12px;font-size:0.8rem" onclick="openEditTaskModal(${t.id})">Edit</button>
    </div>
    <div class="task-detail-body">
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${statusBadge(t.status)} ${priorityBadge(t.priority)}
        </div>
        <h2 style="font-size:1.2rem;margin-bottom:8px">${t.title}</h2>
        ${t.description ? `<p style="font-size:0.875rem;color:var(--text2);line-height:1.6">${t.description}</p>` : '<p style="font-size:0.875rem;color:var(--text3)">No description.</p>'}
      </div>
      <div class="task-detail-meta">
        <div class="meta-field"><div class="meta-label">Assignee</div><div class="meta-value">${t.assignee_name ? `<div style="display:flex;align-items:center;gap:6px">${makeAvatar(t.assignee_name,'avatar-sm')} ${t.assignee_name}</div>` : 'Unassigned'}</div></div>
        <div class="meta-field"><div class="meta-label">Creator</div><div class="meta-value">${t.creator_name}</div></div>
        <div class="meta-field"><div class="meta-label">Due Date</div><div class="meta-value" style="${isOverdue(t.due_date,t.status)?'color:var(--danger)':''}">${formatDate(t.due_date)}</div></div>
        <div class="meta-field"><div class="meta-label">Est. Hours</div><div class="meta-value">${t.estimated_hours ? t.estimated_hours+'h' : '—'}</div></div>
      </div>
      ${t.tags && t.tags !== '[]' ? `<div><div class="meta-label" style="margin-bottom:8px">Tags</div><div class="tags">${JSON.parse(t.tags||'[]').map(tag=>`<span class="tag">#${tag}</span>`).join('')}</div></div>` : ''}

      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${KANBAN_COLS.map(s => `<button onclick="quickStatusChange(${t.id},'${s}')" style="padding:6px 12px;border-radius:6px;font-size:0.8rem;border:1px solid var(--border);background:${t.status===s?COL_COLORS[s]+'33':'var(--surface2)'};color:${t.status===s?COL_COLORS[s]:'var(--text2)'};cursor:pointer;font-family:inherit;font-weight:600">${COL_LABELS[s]}</button>`).join('')}
        </div>
      </div>

      <div class="comments-section">
        <h4>Comments (${comments.length})</h4>
        <div id="commentsList">
          ${comments.map(c => `
            <div class="comment-item">
              ${makeAvatar(c.user_name,'avatar-sm')}
              <div class="comment-body">
                <div class="comment-header">
                  <span class="comment-author">${c.user_name}</span>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span class="comment-time">${formatDate(c.created_at)}</span>
                    ${c.user_id === user?.id || user?.role === 'admin' ? `<button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.8rem" onclick="deleteComment(${t.id},${c.id})">×</button>` : ''}
                  </div>
                </div>
                <div class="comment-text">${c.content}</div>
              </div>
            </div>
          `).join('') || '<p style="font-size:0.8rem;color:var(--text3)">No comments yet.</p>'}
        </div>
        <div class="comment-input-area" style="padding-left:0">
          ${makeAvatar(user?.name||'?')}
          <input id="commentInput" placeholder="Add a comment..." style="padding:10px 12px" onkeydown="if(event.key==='Enter')addComment(${t.id})"/>
          <button class="btn-primary" style="padding:10px 14px" onclick="addComment(${t.id})">Post</button>
        </div>
      </div>
    </div>
  `;
  panel.style.display = 'flex';
  overlay.style.display = 'block';
  overlay.className = 'task-detail-overlay';
}

async function quickStatusChange(taskId, status) {
  await api(`/tasks/${taskId}/status`, { method:'PATCH', body: JSON.stringify({ status }) });
  showToast(`Status → ${COL_LABELS[status]}`, 'success');
  refreshTasks();
  openTaskDetail(taskId);
}

async function addComment(taskId) {
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  if (!content) return;
  const res = await api(`/tasks/${taskId}/comments`, { method:'POST', body: JSON.stringify({ content }) });
  if (res.success) { input.value = ''; openTaskDetail(taskId); }
  else showToast(res.message, 'error');
}

async function deleteComment(taskId, commentId) {
  const res = await api(`/tasks/${taskId}/comments/${commentId}`, { method:'DELETE' });
  if (res.success) openTaskDetail(taskId);
  else showToast(res.message, 'error');
}

function closeTaskDetail() {
  document.getElementById('taskDetailPanel').style.display = 'none';
  document.getElementById('taskDetailOverlay').style.display = 'none';
}

async function refreshTasks() {
  const res = await api('/tasks');
  if (res.success) { allTasks = res.data.tasks; filterTasks(); }
}

init();
