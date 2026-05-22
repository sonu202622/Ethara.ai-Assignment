const { getDb } = require('./db');
const bcrypt = require('bcryptjs');

const seed = async () => {
  const db = await getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) { console.log('✅ Database already seeded'); return; }

  const hashedAdmin = await bcrypt.hash('Admin@123', 12);
  const hashedMember = await bcrypt.hash('Member@123', 12);

  const admin = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Alice Admin', 'alice@taskmanager.io', hashedAdmin, 'admin');
  const bob = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Bob Builder', 'bob@taskmanager.io', hashedMember, 'member');
  const carol = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run('Carol Dev', 'carol@taskmanager.io', hashedMember, 'member');

  const p1 = db.prepare(`INSERT INTO projects (name, description, status, priority, owner_id, due_date, color) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Website Redesign', 'Complete overhaul of company website', 'active', 'high', admin.lastInsertRowid, '2026-06-30', '#6366f1');
  const p2 = db.prepare(`INSERT INTO projects (name, description, status, priority, owner_id, due_date, color) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('Mobile App v2', 'Next version of mobile application', 'active', 'critical', admin.lastInsertRowid, '2026-07-15', '#f59e0b');

  const am = db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`);
  am.run(p1.lastInsertRowid, admin.lastInsertRowid, 'admin');
  am.run(p1.lastInsertRowid, bob.lastInsertRowid, 'member');
  am.run(p1.lastInsertRowid, carol.lastInsertRowid, 'member');
  am.run(p2.lastInsertRowid, admin.lastInsertRowid, 'admin');
  am.run(p2.lastInsertRowid, bob.lastInsertRowid, 'member');

  const at = db.prepare(`INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, creator_id, due_date, estimated_hours, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  at.run('Design new homepage', 'Wireframes and mockups', 'done', 'high', p1.lastInsertRowid, carol.lastInsertRowid, admin.lastInsertRowid, '2026-05-10', 8, '["design","frontend"]');
  at.run('Implement navigation', 'Responsive nav component', 'in_progress', 'high', p1.lastInsertRowid, bob.lastInsertRowid, admin.lastInsertRowid, '2026-05-20', 12, '["frontend"]');
  at.run('Write content strategy', 'SEO and content plan', 'todo', 'medium', p1.lastInsertRowid, null, admin.lastInsertRowid, '2026-06-01', 6, '["content"]');
  at.run('Setup CI/CD pipeline', 'Automated deployment', 'review', 'critical', p1.lastInsertRowid, bob.lastInsertRowid, admin.lastInsertRowid, '2026-04-25', 16, '["devops"]');
  at.run('User authentication flow', 'Login, signup, OAuth', 'in_progress', 'critical', p2.lastInsertRowid, carol.lastInsertRowid, admin.lastInsertRowid, '2026-05-15', 20, '["backend","auth"]');
  at.run('Push notification system', 'Firebase integration', 'todo', 'high', p2.lastInsertRowid, bob.lastInsertRowid, admin.lastInsertRowid, '2026-06-01', 10, '["backend"]');

  console.log('✅ Seed complete!');
  console.log('  Admin: alice@taskmanager.io / Admin@123');
  console.log('  Member: bob@taskmanager.io / Member@123');
  console.log('  Member: carol@taskmanager.io / Member@123');
};

module.exports = seed;
