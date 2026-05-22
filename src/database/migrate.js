const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs-extra');

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'taskmanager.db');

let _sqlDb; // raw sql.js Database
let saveTimeout;

// Persist DB to disk (debounced)
function persistDB() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (_sqlDb) {
      const data = _sqlDb.export();
      fs.ensureDirSync(dbDir);
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
  }, 500);
}

// Wrap sql.js to match the better-sqlite3 sync API surface
function createWrapper(sqlDb) {
  return {
    prepare: (sql) => ({
      run: (...params) => {
        sqlDb.run(sql, params);
        persistDB();
        // Get last insert rowid
        const [{ values }] = sqlDb.exec('SELECT last_insert_rowid()');
        return { lastInsertRowid: values[0][0], changes: 1 };
      },
      get: (...params) => {
        const result = sqlDb.exec(sql, params);
        if (!result.length || !result[0].values.length) return undefined;
        const { columns, values } = result[0];
        return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
      },
      all: (...params) => {
        const result = sqlDb.exec(sql, params);
        if (!result.length) return [];
        const { columns, values } = result[0];
        return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
      }
    }),
    exec: (sql) => {
      sqlDb.run(sql);
      persistDB();
    },
    pragma: () => {},
    close: () => sqlDb.close()
  };
}

// Initialize synchronously-ish with a top-level await workaround
let resolveDb;
const dbReady = new Promise(resolve => { resolveDb = resolve; });

async function init() {
  const SQL = await initSqlJs();
  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }
  _sqlDb = sqlDb;
  const db = createWrapper(sqlDb);
  runMigrations(sqlDb);
  persistDB();
  resolveDb(db);
}

function runMigrations(sqlDb) {
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived', 'on_hold')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      owner_id INTEGER NOT NULL,
      start_date TEXT,
      due_date TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member', 'viewer')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'review', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      project_id INTEGER NOT NULL,
      assignee_id INTEGER,
      creator_id INTEGER NOT NULL,
      due_date TEXT,
      estimated_hours REAL,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
  `);
  console.log('✅ Database migrations complete');
}

// Start init
init().catch(console.error);

module.exports = dbReady;
