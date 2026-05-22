const { validationResult } = require('express-validator');
const { getDb } = require('../database/db');

const log = async (db, userId, action, entityType, entityId, metadata = {}) => {
  try { db.prepare(`INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)`).run(userId, action, entityType, entityId, JSON.stringify(metadata)); } catch(e) {}
};

exports.getProjects = async (req, res) => {
  try {
    const db = await getDb();
    let projects;
    if (req.user.role === 'admin') {
      projects = db.prepare(`
        SELECT p.*, u.name as owner_name, u.email as owner_email,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
        FROM projects p JOIN users u ON p.owner_id = u.id ORDER BY p.created_at DESC
      `).all();
    } else {
      projects = db.prepare(`
        SELECT p.*, u.name as owner_name, u.email as owner_email, pm.role as my_role,
          (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
        FROM projects p JOIN users u ON p.owner_id = u.id
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
    }
    res.json({ success: true, data: { projects } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to fetch projects.' }); }
};

exports.getProject = async (req, res) => {
  try {
    const db = await getDb();
    const project = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
      FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?
    `).get(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar, pm.role, pm.joined_at
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ? ORDER BY u.name
    `).all(req.params.id);
    res.json({ success: true, data: { project, members } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch project.' }); }
};

exports.createProject = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { name, description, status, priority, start_date, due_date, color } = req.body;
  try {
    const db = await getDb();
    const result = db.prepare(`INSERT INTO projects (name, description, status, priority, owner_id, start_date, due_date, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, description, status || 'active', priority || 'medium', req.user.id, start_date, due_date, color || '#6366f1');
    db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')`).run(result.lastInsertRowid, req.user.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    await log(db, req.user.id, 'PROJECT_CREATED', 'project', result.lastInsertRowid, { name });
    res.status(201).json({ success: true, message: 'Project created.', data: { project } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create project.' }); }
};

exports.updateProject = async (req, res) => {
  const { name, description, status, priority, start_date, due_date, color } = req.body;
  try {
    const db = await getDb();
    db.prepare(`UPDATE projects SET name = ?, description = ?, status = ?, priority = ?, start_date = ?, due_date = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(name, description, status, priority, start_date, due_date, color, req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    await log(db, req.user.id, 'PROJECT_UPDATED', 'project', req.params.id, { name });
    res.json({ success: true, data: { project } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update project.' }); }
};

exports.deleteProject = async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    await log(db, req.user.id, 'PROJECT_DELETED', 'project', req.params.id);
    res.json({ success: true, message: 'Project deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete project.' }); }
};

exports.addMember = async (req, res) => {
  const { user_id, role = 'member' } = req.body;
  try {
    const db = await getDb();
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(user_id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, user_id);
    if (existing) return res.status(409).json({ success: false, message: 'User already a member.' });
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user_id, role);
    await log(db, req.user.id, 'MEMBER_ADDED', 'project', req.params.id, { user_id, user_name: user.name });
    res.status(201).json({ success: true, message: `${user.name} added.` });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to add member.' }); }
};

exports.removeMember = async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    await log(db, req.user.id, 'MEMBER_REMOVED', 'project', req.params.id, { user_id: req.params.userId });
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to remove member.' }); }
};
