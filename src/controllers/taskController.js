const { validationResult } = require('express-validator');
const { getDb } = require('../database/db');

const log = async (db, userId, action, entityType, entityId, metadata = {}) => {
  try { db.prepare(`INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)`).run(userId, action, entityType, entityId, JSON.stringify(metadata)); } catch(e) {}
};

exports.getTasks = async (req, res) => {
  const { project_id, status, priority, assignee_id, overdue } = req.query;
  try {
    const db = await getDb();
    let query = `
      SELECT t.*, p.name as project_name, p.color as project_color,
        u1.name as assignee_name, u1.email as assignee_email, u1.avatar as assignee_avatar,
        u2.name as creator_name
      FROM tasks t JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      LEFT JOIN users u2 ON t.creator_id = u2.id
    `;
    const conditions = []; const params = [];
    if (req.user.role !== 'admin') {
      conditions.push(`t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)`);
      params.push(req.user.id);
    }
    if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
    if (assignee_id) { conditions.push('t.assignee_id = ?'); params.push(assignee_id); }
    if (overdue === 'true') { conditions.push(`t.due_date < DATE('now') AND t.status != 'done'`); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ' ORDER BY t.created_at DESC';
    const tasks = db.prepare(query).all(...params);
    res.json({ success: true, data: { tasks } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to fetch tasks.' }); }
};

exports.getTask = async (req, res) => {
  try {
    const db = await getDb();
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, p.color as project_color,
        u1.name as assignee_name, u1.email as assignee_email, u1.avatar as assignee_avatar,
        u2.name as creator_name
      FROM tasks t JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assignee_id = u1.id LEFT JOIN users u2 ON t.creator_id = u2.id
      WHERE t.id = ?
    `).get(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.avatar as user_avatar
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ? ORDER BY c.created_at ASC
    `).all(req.params.id);
    res.json({ success: true, data: { task, comments } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch task.' }); }
};

exports.createTask = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { title, description, status, priority, project_id, assignee_id, due_date, estimated_hours, tags } = req.body;
  try {
    const db = await getDb();
    const projectAccess = req.user.role === 'admin'
      ? db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id)
      : db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, req.user.id);
    if (!projectAccess) return res.status(403).json({ success: false, message: 'No access to this project.' });
    const result = db.prepare(`INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, creator_id, due_date, estimated_hours, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(title, description, status || 'todo', priority || 'medium', project_id, assignee_id || null, req.user.id, due_date, estimated_hours, JSON.stringify(tags || []));
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    await log(db, req.user.id, 'TASK_CREATED', 'task', result.lastInsertRowid, { title, project_id });
    res.status(201).json({ success: true, message: 'Task created.', data: { task } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create task.' }); }
};

exports.updateTask = async (req, res) => {
  const { title, description, status, priority, assignee_id, due_date, estimated_hours, tags } = req.body;
  try {
    const db = await getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
    db.prepare(`UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, estimated_hours = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(title||task.title, description??task.description, status||task.status, priority||task.priority,
        assignee_id!==undefined?assignee_id:task.assignee_id, due_date??task.due_date,
        estimated_hours??task.estimated_hours, tags?JSON.stringify(tags):task.tags, req.params.id);
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    await log(db, req.user.id, 'TASK_UPDATED', 'task', req.params.id, { title: updated.title });
    res.json({ success: true, data: { task: updated } });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to update task.' }); }
};

exports.updateTaskStatus = async (req, res) => {
  const { status } = req.body;
  if (!['todo','in_progress','review','done'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
  try {
    const db = await getDb();
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    await log(db, req.user.id, 'TASK_STATUS_CHANGED', 'task', req.params.id, { status });
    res.json({ success: true, message: 'Status updated.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update status.' }); }
};

exports.deleteTask = async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    await log(db, req.user.id, 'TASK_DELETED', 'task', req.params.id);
    res.json({ success: true, message: 'Task deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete task.' }); }
};

exports.addComment = async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, message: 'Comment required.' });
  try {
    const db = await getDb();
    const result = db.prepare(`INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)`).run(req.params.id, req.user.id, content.trim());
    const comment = db.prepare(`SELECT c.*, u.name as user_name, u.avatar as user_avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: { comment } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to add comment.' }); }
};

exports.deleteComment = async (req, res) => {
  try {
    const db = await getDb();
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found.' });
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Cannot delete this comment.' });
    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete comment.' }); }
};
