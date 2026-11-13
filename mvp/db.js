import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.CLAIMS_DATA_DIR || path.join(here, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'claims.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  payer TEXT, tpa TEXT, claim_no TEXT, patient_ref TEXT,
  admission_date TEXT, discharge_date TEXT, procedure_name TEXT,
  claimed_amount REAL, approved_amount REAL, paid_amount REAL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  line_item TEXT NOT NULL,
  amount REAL NOT NULL,
  stated_reason TEXT,
  category TEXT NOT NULL,
  verdict TEXT NOT NULL,
  confidence REAL,
  rationale TEXT,
  evidence_needed TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewer_note TEXT,
  appeal_id INTEGER REFERENCES appeals(id) ON DELETE SET NULL,
  outcome TEXT,
  recovered_amount REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
  entity TEXT NOT NULL, entity_id INTEGER, detail TEXT
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, file_name TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bill_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  description TEXT NOT NULL, category TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT, canonical_name TEXT, entity_class TEXT,
  quantity REAL, unit_price REAL, amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS clinical_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  key TEXT NOT NULL, label TEXT NOT NULL, grp TEXT NOT NULL, value TEXT NOT NULL, quote TEXT, confidence REAL
);
`);

const addColumn = (table, column, def) => {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
};
addColumn('claims', 'settlement_date', 'TEXT');
addColumn('deductions', 'evidence_done', "TEXT NOT NULL DEFAULT '[]'");
addColumn('appeals', 'filed_at', 'TEXT');
addColumn('claims', 'clinical_domain', 'TEXT');
addColumn('claims', 'submitted_at', 'TEXT');
addColumn('claims', 'predicted_cut', 'REAL');
db.exec(`CREATE TABLE IF NOT EXISTS prefiling_actions (
  claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL, done_at TEXT NOT NULL, actor TEXT,
  PRIMARY KEY (claim_id, flag_key)
);`);

const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
seed.run('hospital_name', 'Demo Hospital');
seed.run('success_fee_percent', '15');
seed.run('reviewer_name', 'Reviewer');

export const now = () => new Date().toISOString();

export function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

export function audit(action, entity, entityId, detail) {
  const actor = getSettings().reviewer_name || 'Reviewer';
  db.prepare('INSERT INTO audit_log (ts, actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(now(), actor, action, entity, entityId ?? null, detail ?? null);
}

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
