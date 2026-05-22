const { getDb } = require('../database/db');

exports.getDashboard = async (req, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const taskStats = isAdmin
      ? db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo, SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress, SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN due_date < DATE('now') AND status!='done' THEN 1 ELSE 0 END) as overdue FROM tasks`).get()
      : db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo, SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress, SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN due_date < DATE('now') AND status!='done' THEN 1 ELSE 0 END) as overdue FROM tasks WHERE assignee_id=? OR creator_id=?`).get(userId, userId);

    const projectStats = isAdmin
      ? db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='on_hold' THEN 1 ELSE 0 END) as on_hold FROM projects`).get()
      : db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN p.status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN p.status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN p.status='on_hold' THEN 1 ELSE 0 END) as on_hold FROM projects p JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=?`).get(userId);

    const myTasks = db.prepare(`SELECT t.id, t.title, t.status, t.priority, t.due_date, p.name as project_name, p.color as project_color FROM tasks t JOIN projects p ON t.project_id=p.id WHERE t.assignee_id=? AND t.status!='done' ORDER BY t.due_date ASC, t.priority DESC LIMIT 10`).all(userId);

    const overdueTasks = isAdmin
      ? db.prepare(`SELECT t.id, t.title, t.status, t.priority, t.due_date, p.name as project_name, p.color as project_color, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id=p.id LEFT JOIN users u ON t.assignee_id=u.id WHERE t.due_date < DATE('now') AND t.status!='done' ORDER BY t.due_date ASC LIMIT 10`).all()
      : db.prepare(`SELECT t.id, t.title, t.status, t.priority, t.due_date, p.name as project_name, p.color as project_color, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id=p.id LEFT JOIN users u ON t.assignee_id=u.id WHERE t.due_date < DATE('now') AND t.status!='done' AND (t.assignee_id=? OR t.creator_id=?) ORDER BY t.due_date ASC LIMIT 10`).all(userId, userId);

    const recentActivity = db.prepare(`SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC LIMIT 15`).all();

    const teamStats = isAdmin
      ? db.prepare(`SELECT u.id, u.name, u.email, u.role, u.avatar, u.created_at, COUNT(DISTINCT t.id) as assigned_tasks, SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as completed_tasks FROM users u LEFT JOIN tasks t ON t.assignee_id=u.id GROUP BY u.id ORDER BY u.name`).all()
      : null;

    const tasksByPriority = isAdmin
      ? db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE status!='done' GROUP BY priority`).all()
      : db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE status!='done' AND (assignee_id=? OR creator_id=?) GROUP BY priority`).all(userId, userId);

    res.json({ success: true, data: { taskStats, projectStats, myTasks, overdueTasks, recentActivity, teamStats, tasksByPriority } });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
};
