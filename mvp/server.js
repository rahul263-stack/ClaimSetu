import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, now, audit, tx, getSettings } from './db.js';
import { auditFile, draftAppeal, claudeConfigured } from './extract.js';
import { CATEGORIES, CATEGORY_KEYS, VERDICTS } from './rules.js';
import { detectType, readBill, readSummary } from './clinical.js';
import { registrySummary, domainLabel, BILL_CATEGORIES } from './registry.js';
import { evaluateClaim, preSubmission, allPayerRules, payerRules } from './payer-rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY = 40 * 1024 * 1024;
const FOLLOW_UP_DAYS = 15;
const STATIC = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
const OUTCOMES = ['won', 'partly_won', 'lost'];
const APPEAL_STATUSES = ['draft', 'approved', 'filed'];
const CONTESTABLE = "('recoverable','partly_recoverable')";

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'Upload too large (limit 40 MB per request).')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'Invalid JSON body.')); } });
    req.on('error', reject);
  });
}

const catLabel = k => CATEGORIES[k]?.label || k;
const isContestable = d => d.verdict === 'recoverable' || d.verdict === 'partly_recoverable';
const daysBetween = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null; };
const parseList = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

// ---------- Data access ----------
function saveAudit(fileName, a) {
  return tx(() => {
    const existing = a.claim_no ? db.prepare('SELECT * FROM claims WHERE claim_no = ?').get(a.claim_no) : null;
    if (existing && existing.source !== 'stub') throw new Error(`Claim ${a.claim_no} has already been audited.`);
    const vals = [fileName, a.payer, a.tpa, a.claim_no, a.patient_ref, a.admission_date, a.discharge_date, a.settlement_date ?? null, a.procedure_name, a.claimed_amount, a.approved_amount, a.paid_amount, a.source];
    let claimId;
    if (existing) {
      db.prepare(`UPDATE claims SET file_name = ?, payer = ?, tpa = ?, claim_no = ?, patient_ref = ?, admission_date = ?, discharge_date = ?, settlement_date = ?, procedure_name = ?, claimed_amount = ?, approved_amount = ?, paid_amount = ?, source = ? WHERE id = ?`).run(...vals, existing.id);
      claimId = existing.id;
    } else {
      claimId = Number(db.prepare(`INSERT INTO claims (file_name, payer, tpa, claim_no, patient_ref, admission_date, discharge_date, settlement_date, procedure_name, claimed_amount, approved_amount, paid_amount, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...vals, now()).lastInsertRowid);
    }
    db.prepare("INSERT INTO documents (claim_id, doc_type, file_name, source, created_at) VALUES (?, 'settlement', ?, ?, ?)").run(claimId, fileName, a.source, now());
    const ins = db.prepare(`INSERT INTO deductions (claim_id, line_item, amount, stated_reason, category, verdict, confidence, rationale, evidence_needed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const d of a.deductions) ins.run(claimId, d.line_item, d.amount, d.stated_reason, d.category, d.verdict, d.confidence, d.rationale, JSON.stringify(d.evidence_needed || []));
    audit('audited', 'claim', claimId, `${fileName}: ${a.deductions.length} deductions found (${a.source})`);
    return claimId;
  });
}

const claimRow = id => db.prepare('SELECT * FROM claims WHERE id = ?').get(id);

// A bill or summary can arrive before the settlement letter; it then waits on a placeholder claim.
function claimFor(claimNo, patientRef, fileName) {
  if (!claimNo) throw new Error('No claim number was found in this document, so it cannot be linked to a claim.');
  const existing = db.prepare('SELECT id FROM claims WHERE claim_no = ?').get(claimNo);
  if (existing) return existing.id;
  return Number(db.prepare("INSERT INTO claims (file_name, claim_no, patient_ref, source, created_at) VALUES (?, ?, ?, 'stub', ?)").run(fileName, claimNo, patientRef, now()).lastInsertRowid);
}

function saveBill(fileName, b) {
  return tx(() => {
    const claimId = claimFor(b.claim_no, b.patient_ref, fileName);
    db.prepare('DELETE FROM bill_lines WHERE claim_id = ?').run(claimId);
    db.prepare("DELETE FROM documents WHERE claim_id = ? AND doc_type = 'bill'").run(claimId);
    const ins = db.prepare('INSERT INTO bill_lines (claim_id, description, category, entity_type, entity_id, canonical_name, entity_class, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const l of b.lines) ins.run(claimId, l.description, l.category, l.entity_type, l.entity_id, l.canonical_name, l.entity_class, l.quantity, l.unit_price, l.amount);
    // A claim not yet settled takes its payer and claimed amount from the bill.
    const c = claimRow(claimId);
    if (c.source === 'stub') db.prepare('UPDATE claims SET payer = COALESCE(?, payer), claimed_amount = ? WHERE id = ?').run(b.payer || null, b.lines.reduce((t, l) => t + l.amount, 0), claimId);
    db.prepare("INSERT INTO documents (claim_id, doc_type, file_name, source, created_at) VALUES (?, 'bill', ?, ?, ?)").run(claimId, fileName, b.source, now());
    audit('read', 'bill', claimId, `${fileName}: ${b.lines.length} lines (${b.source})`);
    return claimId;
  });
}

function saveSummary(fileName, s) {
  return tx(() => {
    const claimId = claimFor(s.claim_no, s.patient_ref, fileName);
    db.prepare('DELETE FROM clinical_facts WHERE claim_id = ?').run(claimId);
    db.prepare("DELETE FROM documents WHERE claim_id = ? AND doc_type = 'summary'").run(claimId);
    const ins = db.prepare('INSERT INTO clinical_facts (claim_id, key, label, grp, value, quote, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const f of s.facts) ins.run(claimId, f.key, f.label, f.group, f.value, f.quote, f.confidence);
    db.prepare('UPDATE claims SET clinical_domain = ? WHERE id = ?').run(s.domain, claimId);
    const proc = s.facts.find(f => f.key === 'procedure_performed');
    if (proc) db.prepare("UPDATE claims SET procedure_name = COALESCE(procedure_name, ?) WHERE id = ? AND source = 'stub'").run(proc.value, claimId);
    db.prepare("INSERT INTO documents (claim_id, doc_type, file_name, source, created_at) VALUES (?, 'summary', ?, ?, ?)").run(claimId, fileName, s.source, now());
    audit('read', 'summary', claimId, `${fileName}: ${s.facts.length} clinical facts, domain ${s.domain || 'unknown'} (${s.source})`);
    return claimId;
  });
}

// ---------- Linking deductions to the bill ----------
const STOP = new Set(['charges', 'charge', 'items', 'policy', 'benefit', 'sessions', 'days', 'day', 'stay', 'with', 'and', 'the', 'for', 'per']);
const CATEGORY_HINTS = [['room', /room|icu|nursing|\bstay\b|ward/i], ['device', /implant|stent|device|prosthe/i], ['drug', /pharmacy|drug|medicine|medication/i], ['consumable', /consumable|disposable/i],
  ['investigation', /patholog|echo|investigation|laborator|radiolog|scan|x-ray/i], ['procedure', /cath lab|theatre|\bot\b|physiotherapy|procedure/i], ['other', /registration|admin/i]];

// Bill lines a deduction most plausibly refers to: matching words first, then a category guess.
function relatedLines(d, lines) {
  if (!lines.length) return { lines: [], category: null, basis: null };
  const words = String(d.line_item).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
  const res = words.map(w => new RegExp('\\b' + w + '\\b', 'i'));
  const byWord = lines.filter(l => res.some(re => re.test(l.description)));
  if (byWord.length) return { lines: byWord, category: byWord[0].category, basis: 'wording' };
  const hint = CATEGORY_HINTS.find(([, re]) => re.test(d.line_item));
  if (hint) { const byCat = lines.filter(l => l.category === hint[0]); if (byCat.length) return { lines: byCat, category: hint[0], basis: 'category' }; }
  return { lines: [], category: null, basis: null };
}

// Checks a biller could run before the bill goes out.
function billChecks(lines, medians) {
  const flags = [];
  const seen = new Set();
  for (const l of lines) {
    const k = `${l.description.toLowerCase()}|${l.quantity}|${l.unit_price}`;
    if (seen.has(k)) flags.push({ line_id: l.id, kind: 'duplicate', text: `"${l.description}" appears twice with the same quantity and price` });
    seen.add(k);
    if (l.category === 'consumable' || l.category === 'other') flags.push({ line_id: l.id, kind: 'non_payable', text: `"${l.description}" is in a category payers often treat as non-payable` });
    const med = l.entity_id && medians.get(l.entity_id);
    if (med && med.n >= 3 && l.unit_price > med.median * 1.2) flags.push({ line_id: l.id, kind: 'price', text: `"${l.description}" is billed at ${Math.round(l.unit_price)} a unit, ${Math.round((l.unit_price / med.median - 1) * 100)}% above this hospital's usual ${Math.round(med.median)}` });
  }
  return flags;
}

function entityMedians() {
  const map = new Map();
  for (const r of db.prepare('SELECT entity_id, unit_price FROM bill_lines WHERE entity_id IS NOT NULL AND unit_price IS NOT NULL ORDER BY entity_id, unit_price').all()) {
    if (!map.has(r.entity_id)) map.set(r.entity_id, []);
    map.get(r.entity_id).push(r.unit_price);
  }
  return new Map([...map].map(([k, v]) => [k, { n: v.length, median: v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2 }]));
}

// Rough chance of winning a line back: this payer's record on this reason if there is one, else the assessment.
function winEstimate(d, history) {
  if (history && history.decided_lines) return { p: history.win_rate, basis: 'history' };
  const c = Number(d.confidence) || 0.5;
  const p = d.verdict === 'recoverable' ? c : d.verdict === 'partly_recoverable' ? c * 0.5 : d.verdict === 'needs_review' ? 0.3 : 0.05;
  return { p, basis: 'assessment' };
}

function priceAnalytics() {
  const lines = db.prepare("SELECT b.*, COALESCE(c.payer, 'Unknown payer') AS payer FROM bill_lines b JOIN claims c ON c.id = b.claim_id").all();
  const groups = new Map();
  for (const l of lines) {
    if (!l.entity_id || l.unit_price == null) continue;
    const k = l.entity_type + '|' + l.entity_id;
    if (!groups.has(k)) groups.set(k, { entity_type: l.entity_type, entity_id: l.entity_id, name: l.canonical_name, entity_class: l.entity_class, lines: [] });
    groups.get(k).lines.push(l);
  }
  const entities = [...groups.values()].map(g => {
    const prices = g.lines.map(l => l.unit_price).sort((a, b) => a - b);
    const qty = g.lines.reduce((t, l) => t + (l.quantity || 0), 0), billed = g.lines.reduce((t, l) => t + l.amount, 0);
    return { entity_type: g.entity_type, entity_id: g.entity_id, name: g.name, entity_class: g.entity_class, claims: new Set(g.lines.map(l => l.claim_id)).size, quantity: qty, billed,
      min: prices[0], max: prices[prices.length - 1], avg: qty ? billed / qty : prices[0], spread: prices[0] > 0 ? prices[prices.length - 1] / prices[0] - 1 : 0,
      points: g.lines.map(l => ({ payer: l.payer, unit_price: l.unit_price, claim_id: l.claim_id })) };
  }).sort((a, b) => b.spread - a.spread || b.billed - a.billed);

  // Billed against cut, per payer and bill category.
  const cat = new Map();
  const bump = (payer, category, field, v) => { const k = payer + '|' + category; if (!cat.has(k)) cat.set(k, { payer, category, billed: 0, cut: 0 }); cat.get(k)[field] += v; };
  for (const l of lines) bump(l.payer, l.category, 'billed', l.amount);
  const linesByClaim = new Map();
  for (const l of lines) { if (!linesByClaim.has(l.claim_id)) linesByClaim.set(l.claim_id, []); linesByClaim.get(l.claim_id).push(l); }
  let unlinked = 0;
  for (const d of db.prepare("SELECT d.*, COALESCE(c.payer, 'Unknown payer') AS payer FROM deductions d JOIN claims c ON c.id = d.claim_id").all()) {
    const rel = relatedLines(d, linesByClaim.get(d.claim_id) || []);
    if (rel.category) bump(d.payer, rel.category, 'cut', d.amount); else unlinked += d.amount;
  }
  const categories = [...cat.values()].filter(c => c.billed > 0).map(c => ({ ...c, cut_rate: c.cut / c.billed })).sort((a, b) => b.cut - a.cut || b.billed - a.billed);

  const procedures = db.prepare(`SELECT COALESCE(procedure_name, 'Unknown') AS procedure_name, COALESCE(payer, 'Unknown payer') AS payer, COUNT(*) AS claims, SUM(claimed_amount) AS claimed, SUM(approved_amount) AS approved
    FROM claims WHERE source != 'stub' GROUP BY 1, 2 ORDER BY claimed DESC`).all().map(p => ({ ...p, approval_rate: p.claimed ? p.approved / p.claimed : null }));
  return { entities, categories, procedures, unlinked_cut: unlinked, bill_lines: lines.length, bills: linesByClaim.size };
}

// What has happened before when this payer made this kind of cut.
function knowledge() {
  return db.prepare(`SELECT COALESCE(c.payer, 'Unknown payer') AS payer, d.category,
      COUNT(*) AS lines, SUM(d.amount) AS amount,
      SUM(CASE WHEN a.status = 'filed' THEN 1 ELSE 0 END) AS contested_lines,
      SUM(CASE WHEN a.status = 'filed' AND d.outcome IS NOT NULL THEN 1 ELSE 0 END) AS decided_lines,
      SUM(CASE WHEN a.status = 'filed' AND d.outcome IN ('won','partly_won') THEN 1 ELSE 0 END) AS won_lines,
      SUM(CASE WHEN a.status = 'filed' AND d.outcome IS NOT NULL THEN d.amount ELSE 0 END) AS decided_amount,
      SUM(d.recovered_amount) AS recovered
    FROM deductions d JOIN claims c ON c.id = d.claim_id LEFT JOIN appeals a ON a.id = d.appeal_id
    GROUP BY COALESCE(c.payer, 'Unknown payer'), d.category ORDER BY amount DESC`).all()
    .map(r => ({ ...r, category_label: catLabel(r.category), win_rate: r.decided_amount > 0 ? r.recovered / r.decided_amount : null }));
}

function historyLookup() {
  const map = new Map(knowledge().map(k => [`${k.payer}|${k.category}`, k]));
  return (payer, category) => {
    const k = map.get(`${payer || 'Unknown payer'}|${category}`);
    return k && k.decided_lines ? { decided_lines: k.decided_lines, won_lines: k.won_lines, win_rate: k.win_rate } : null;
  };
}

function shapeDeduction(d, history, finding = null) {
  let est = winEstimate(d, history), contestable = d.amount;
  if (finding) {
    contestable = finding.excess;
    if (!(history && history.decided_lines)) est = { p: finding.excess > 0 ? (finding.certain ? 0.75 : 0.5) : 0, basis: 'rules' };
  }
  return { ...d, evidence_needed: parseList(d.evidence_needed), evidence_done: parseList(d.evidence_done), category_label: catLabel(d.category), history, finding,
    win_probability: est.p, win_basis: est.basis, expected_value: Math.round(contestable * est.p) };
}

// Rules findings for every deduction on a claim, keyed by deduction id.
function findingsFor(claim, rows) {
  const bill = db.prepare('SELECT * FROM bill_lines WHERE claim_id = ? ORDER BY id').all(claim.id);
  const facts = db.prepare('SELECT * FROM clinical_facts WHERE claim_id = ?').all(claim.id);
  return evaluateClaim(claim, bill, facts, rows, d => relatedLines(d, bill).lines);
}

// Where a claim stands before it is filed: what to fix, what to collect, what is still at risk.
function prefilingState(claim, bill, facts) {
  const done = new Set(db.prepare('SELECT flag_key FROM prefiling_actions WHERE claim_id = ?').all(claim.id).map(r => r.flag_key));
  const flags = preSubmission(claim, bill, facts).map(f => ({ ...f, done: done.has(f.key) }));
  const billed = bill.reduce((t, l) => t + l.amount, 0);
  const total = action => flags.filter(f => f.action === action).reduce((t, f) => t + (f.amount || 0), 0);
  const open = flags.filter(f => !f.done);
  return { flags, billed, patient_share: total('collect'), bill_corrections: total('fix'), expected_from_payer: billed - total('collect') - total('fix'),
    at_risk: open.reduce((t, f) => t + (f.amount ?? f.risk ?? 0), 0), open: open.length, total: flags.length, ready: bill.length > 0 && open.length === 0 };
}

function prefilingList() {
  return db.prepare("SELECT * FROM claims WHERE source = 'stub' ORDER BY id DESC").all().map(c => {
    const bill = db.prepare('SELECT * FROM bill_lines WHERE claim_id = ?').all(c.id);
    const facts = db.prepare('SELECT * FROM clinical_facts WHERE claim_id = ?').all(c.id);
    const { flags, ...state } = prefilingState(c, bill, facts);
    return { id: c.id, claim_no: c.claim_no || c.file_name, payer: c.payer, procedure_name: c.procedure_name, submitted_at: c.submitted_at, predicted_cut: c.predicted_cut,
      has_bill: bill.length > 0, has_summary: facts.length > 0, has_rules: Boolean(payerRules(c.payer)), ...state };
  });
}

function setPrefilingFlag(claimId, body) {
  const c = claimRow(claimId);
  if (!c) throw new HttpError(404, 'Claim not found.');
  if (c.submitted_at) throw new HttpError(400, 'This claim has already been marked as filed.');
  if (typeof body.key !== 'string' || !body.key) throw new HttpError(400, 'Missing item.');
  if (body.done) db.prepare('INSERT OR REPLACE INTO prefiling_actions (claim_id, flag_key, done_at, actor) VALUES (?, ?, ?, ?)').run(claimId, body.key, now(), getSettings().reviewer_name);
  else db.prepare('DELETE FROM prefiling_actions WHERE claim_id = ? AND flag_key = ?').run(claimId, body.key);
  audit('checked', 'pre-filing item', claimId, `${body.key} ${body.done ? 'done' : 'reopened'}`);
  return claimDetail(claimId);
}

function updateClaim(claimId, body) {
  const c = claimRow(claimId);
  if (!c) throw new HttpError(404, 'Claim not found.');
  if (c.source !== 'stub') throw new HttpError(400, 'Only a claim that has not been settled can be edited.');
  if (body.payer !== undefined) {
    db.prepare('UPDATE claims SET payer = ? WHERE id = ?').run(String(body.payer).slice(0, 200) || null, claimId);
    db.prepare('DELETE FROM prefiling_actions WHERE claim_id = ?').run(claimId);
    audit('updated', 'claim', claimId, `payer set to ${body.payer}`);
  }
  return claimDetail(claimId);
}

// Marking as filed freezes the prediction, so it can be compared with the settlement when that arrives.
function submitClaim(claimId) {
  const d = claimDetail(claimId);
  if (d.claim.source !== 'stub') throw new HttpError(400, 'This claim already has a settlement letter.');
  if (!d.bill.length) throw new HttpError(400, 'Upload the itemised bill before filing.');
  db.prepare('UPDATE claims SET submitted_at = ?, predicted_cut = ? WHERE id = ?').run(now(), d.prefiling.at_risk, claimId);
  audit('filed', 'claim', claimId, `${d.prefiling.open} items open, ${Math.round(d.prefiling.at_risk)} predicted cut`);
  return claimDetail(claimId);
}

function rulesOverview() {
  const claims = db.prepare("SELECT * FROM claims WHERE source != 'stub' ORDER BY id").all();
  const backtest = claims.map(c => {
    const rows = db.prepare('SELECT * FROM deductions WHERE claim_id = ?').all(c.id);
    const f = findingsFor(c, rows);
    const cut = rows.reduce((t, d) => t + d.amount, 0);
    const covered = rows.filter(d => f.has(d.id));
    return { claim_id: c.id, claim_no: c.claim_no || c.file_name, payer: c.payer, has_rules: Boolean(payerRules(c.payer)), cut,
      permitted: covered.reduce((t, d) => t + f.get(d.id).permitted_cut, 0), over_deducted: covered.reduce((t, d) => t + f.get(d.id).excess, 0),
      no_rule: rows.filter(d => !f.has(d.id)).reduce((t, d) => t + d.amount, 0), lines: rows.length, lines_covered: covered.length };
  });
  return { payers: allPayerRules(), backtest };
}

function claimDetail(id) {
  const claim = claimRow(id);
  if (!claim) throw new HttpError(404, 'Claim not found.');
  const hist = historyLookup();
  const rawDeductions = db.prepare('SELECT * FROM deductions WHERE claim_id = ? ORDER BY id').all(id);
  const found = findingsFor(claim, rawDeductions);
  const deductions = rawDeductions.map(d => shapeDeduction(d, hist(claim.payer, d.category), found.get(d.id) || null));
  const appeal = db.prepare('SELECT * FROM appeals WHERE claim_id = ? ORDER BY id DESC LIMIT 1').get(id) || null;
  if (appeal) appeal.days_since_filed = appeal.filed_at ? daysBetween(appeal.filed_at, now()) : null;
  const bill = db.prepare('SELECT * FROM bill_lines WHERE claim_id = ? ORDER BY id').all(id);
  for (const d of deductions) {
    const rel = relatedLines(d, bill);
    d.related = rel.lines.length ? { basis: rel.basis, category: rel.category, count: rel.lines.length, billed: rel.lines.reduce((t, l) => t + l.amount, 0), line_ids: rel.lines.map(l => l.id) } : null;
  }
  const facts = db.prepare('SELECT * FROM clinical_facts WHERE claim_id = ? ORDER BY id').all(id);
  const documents = db.prepare('SELECT doc_type, file_name, source FROM documents WHERE claim_id = ? ORDER BY id').all(id);
  const pf = prefilingState(claim, bill, facts);
  return { claim: { ...claim, clinical_domain_label: claim.clinical_domain ? domainLabel(claim.clinical_domain) : null }, deductions, appeal, bill, bill_checks: billChecks(bill, entityMedians()), facts, documents, pre_submission: pf.flags, prefiling: pf, has_payer_rules: Boolean(payerRules(claim.payer)), payer_options: allPayerRules().map(p => p.payer) };
}

function allDeductions() {
  const hist = historyLookup();
  const claimsById = new Map(db.prepare('SELECT * FROM claims').all().map(c => [c.id, c]));
  const findingCache = new Map();
  return db.prepare(`SELECT d.*, c.payer, c.claim_no, c.file_name, c.procedure_name, a.status AS appeal_status
    FROM deductions d JOIN claims c ON c.id = d.claim_id LEFT JOIN appeals a ON a.id = d.appeal_id ORDER BY d.amount DESC`).all()
    .map(d => { const c = claimsById.get(d.claim_id); if (!findingCache.has(c.id)) findingCache.set(c.id, findingsFor(c, db.prepare('SELECT * FROM deductions WHERE claim_id = ?').all(c.id))); return shapeDeduction(d, hist(d.payer, d.category), findingCache.get(c.id).get(d.id) || null); }).sort((a, b) => b.expected_value - a.expected_value || b.amount - a.amount);
}

function listClaims() {
  return db.prepare(`SELECT c.*,
      COUNT(d.id) AS deduction_count,
      COALESCE(SUM(d.amount), 0) AS deducted,
      COALESCE(SUM(CASE WHEN d.verdict IN ${CONTESTABLE} THEN d.amount ELSE 0 END), 0) AS assessed_recoverable,
      COALESCE(SUM(CASE WHEN d.review_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_review,
      COALESCE(SUM(d.recovered_amount), 0) AS recovered,
      COALESCE(SUM(CASE WHEN d.appeal_id IS NOT NULL AND d.outcome IS NULL THEN 1 ELSE 0 END), 0) AS undecided_lines,
      (SELECT status FROM appeals a WHERE a.claim_id = c.id ORDER BY a.id DESC LIMIT 1) AS appeal_status,
      (SELECT filed_at FROM appeals a WHERE a.claim_id = c.id ORDER BY a.id DESC LIMIT 1) AS appeal_filed_at,
      (SELECT GROUP_CONCAT(doc_type) FROM documents x WHERE x.claim_id = c.id) AS doc_types
    FROM claims c LEFT JOIN deductions d ON d.claim_id = c.id GROUP BY c.id ORDER BY c.id DESC`).all()
    .map(c => ({ ...c, stage: stageOf(c), days_since_filed: c.appeal_filed_at ? daysBetween(c.appeal_filed_at, now()) : null }));
}

function stageOf(c) {
  if (c.source === 'stub') return c.submitted_at ? 'filed_awaiting' : 'pre_filing';
  if (c.appeal_status === 'filed') return c.undecided_lines ? 'filed' : 'decided';
  if (c.appeal_status === 'approved') return 'approved';
  if (c.appeal_status === 'draft') return 'drafted';
  if (c.deduction_count && !c.pending_review) return 'reviewed';
  return 'audited';
}

function summary() {
  const s = getSettings();
  const t = db.prepare(`SELECT
      COALESCE(SUM(d.amount), 0) AS deducted,
      COALESCE(SUM(CASE WHEN d.verdict IN ${CONTESTABLE} THEN d.amount ELSE 0 END), 0) AS assessed_recoverable,
      COALESCE(SUM(CASE WHEN d.verdict = 'needs_review' THEN d.amount ELSE 0 END), 0) AS needs_review,
      COALESCE(SUM(CASE WHEN d.verdict = 'not_recoverable' THEN d.amount ELSE 0 END), 0) AS not_recoverable,
      COALESCE(SUM(CASE WHEN a.status = 'filed' THEN d.amount ELSE 0 END), 0) AS contested,
      COALESCE(SUM(CASE WHEN a.status = 'filed' AND d.outcome IS NULL THEN d.amount ELSE 0 END), 0) AS awaiting_outcome,
      COALESCE(SUM(CASE WHEN a.status = 'filed' AND d.outcome IS NOT NULL THEN d.amount ELSE 0 END), 0) AS decided,
      COALESCE(SUM(d.recovered_amount), 0) AS recovered,
      COALESCE(SUM(CASE WHEN d.review_status = 'pending' THEN 1 ELSE 0 END), 0) AS lines_pending_review,
      COALESCE(SUM(CASE WHEN d.review_status = 'pending' AND d.verdict != 'not_recoverable' THEN d.amount ELSE 0 END), 0) AS amount_pending_review
    FROM deductions d LEFT JOIN appeals a ON a.id = d.appeal_id`).get();
  const claims = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(claimed_amount),0) AS claimed, COALESCE(SUM(approved_amount),0) AS approved FROM claims WHERE source != 'stub'").get();
  const days = db.prepare('SELECT discharge_date, settlement_date FROM claims').all().map(c => daysBetween(c.discharge_date, c.settlement_date)).filter(d => d !== null && d >= 0);
  const list = listClaims();
  const feePct = Number(s.success_fee_percent) || 0;
  return {
    mode: claudeConfigured() ? 'claude' : 'demo',
    settings: s,
    claims: claims.n, claimed: claims.claimed, approved: claims.approved,
    ...t,
    win_rate: t.decided > 0 ? t.recovered / t.decided : null,
    success_fee: t.recovered * feePct / 100,
    scorecard: {
      settled_before: claims.claimed ? claims.approved / claims.claimed : null,
      settled_now: claims.claimed ? (claims.approved + t.recovered) / claims.claimed : null,
      avg_days_to_payment: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      claims_with_dates: days.length,
      contested_won: t.decided > 0 ? t.recovered / t.decided : null
    },
    actions: {
      to_review_lines: t.lines_pending_review,
      to_review_amount: t.amount_pending_review,
      ready_to_draft: list.filter(c => c.stage === 'reviewed' && c.assessed_recoverable > 0).length,
      drafts_to_approve: list.filter(c => c.stage === 'drafted').length,
      approved_to_file: list.filter(c => c.stage === 'approved').length,
      awaiting_decision: list.filter(c => c.stage === 'filed').length,
      follow_up_due: list.filter(c => c.stage === 'filed' && c.days_since_filed >= FOLLOW_UP_DAYS).length,
      follow_up_days: FOLLOW_UP_DAYS,
      prefiling_open: prefilingList().filter(c => !c.submitted_at).length,
      prefiling_at_risk: prefilingList().filter(c => !c.submitted_at).reduce((t, c) => t + c.at_risk, 0)
    },
    by_payer: db.prepare(`SELECT COALESCE(c.payer, 'Unknown payer') AS payer, COUNT(DISTINCT c.id) AS claims,
        COALESCE(SUM(d.amount),0) AS deducted,
        COALESCE(SUM(CASE WHEN d.verdict IN ${CONTESTABLE} THEN d.amount ELSE 0 END),0) AS assessed_recoverable,
        COALESCE(SUM(d.recovered_amount),0) AS recovered
      FROM claims c LEFT JOIN deductions d ON d.claim_id = c.id WHERE c.source != 'stub' GROUP BY COALESCE(c.payer, 'Unknown payer') ORDER BY deducted DESC`).all(),
    by_category: db.prepare(`SELECT category, COUNT(*) AS lines, SUM(amount) AS amount,
        SUM(CASE WHEN verdict IN ${CONTESTABLE} THEN amount ELSE 0 END) AS assessed_recoverable
      FROM deductions GROUP BY category ORDER BY amount DESC`).all().map(r => ({ ...r, category_label: catLabel(r.category) }))
  };
}

// ---------- Actions ----------
async function ingest(files) {
  if (!Array.isArray(files) || !files.length) throw new HttpError(400, 'No files received.');
  const results = [];
  for (const f of files) {
    try {
      if (!f || typeof f.name !== 'string' || typeof f.dataBase64 !== 'string') throw new Error('Malformed file entry.');
      const kind = await detectType(f);
      if (kind.doc_type === 'bill') {
        const b = await readBill(f);
        results.push({ file: f.name, ok: true, doc_type: 'bill', claim_id: saveBill(f.name, b), lines: b.lines.length });
      } else if (kind.doc_type === 'summary') {
        const sum = await readSummary(f, kind.clinical_domain);
        results.push({ file: f.name, ok: true, doc_type: 'summary', claim_id: saveSummary(f.name, sum), facts: sum.facts.length });
      } else if (kind.doc_type === 'settlement') {
        const a = await auditFile(f);
        results.push({ file: f.name, ok: true, doc_type: 'settlement', claim_id: saveAudit(f.name, a), deductions: a.deductions.length });
      } else throw new Error('This does not look like a settlement letter, itemised bill or discharge summary.');
    } catch (e) {
      results.push({ file: f?.name || 'unknown', ok: false, error: e.message });
    }
  }
  return { results };
}

function updateDeduction(id, body) {
  const d = db.prepare('SELECT d.*, a.status AS appeal_status FROM deductions d LEFT JOIN appeals a ON a.id = d.appeal_id WHERE d.id = ?').get(id);
  if (!d) throw new HttpError(404, 'Deduction not found.');
  const locked = d.appeal_status === 'filed';
  const changes = [];
  if (body.verdict !== undefined) {
    if (locked) throw new HttpError(400, 'This line is part of a filed appeal and cannot be re-assessed.');
    if (!VERDICTS.includes(body.verdict)) throw new HttpError(400, 'Unknown verdict.');
    const status = body.verdict === d.verdict ? 'confirmed' : 'overridden';
    db.prepare('UPDATE deductions SET verdict = ?, review_status = ? WHERE id = ?').run(body.verdict, status, id);
    // A line the reviewer rules out leaves any unfiled appeal it was part of.
    if (!isContestable({ verdict: body.verdict })) db.prepare('UPDATE deductions SET appeal_id = NULL WHERE id = ?').run(id);
    changes.push(`${status} as ${body.verdict}`);
  }
  if (body.category !== undefined) {
    if (!CATEGORY_KEYS.includes(body.category)) throw new HttpError(400, 'Unknown category.');
    db.prepare('UPDATE deductions SET category = ? WHERE id = ?').run(body.category, id);
    changes.push(`category ${body.category}`);
  }
  if (body.reviewer_note !== undefined) {
    db.prepare('UPDATE deductions SET reviewer_note = ? WHERE id = ?').run(String(body.reviewer_note).slice(0, 2000) || null, id);
    changes.push('note updated');
  }
  if (body.evidence_done !== undefined) {
    const needed = parseList(d.evidence_needed);
    const done = Array.isArray(body.evidence_done) ? body.evidence_done.filter(e => needed.includes(e)) : [];
    db.prepare('UPDATE deductions SET evidence_done = ? WHERE id = ?').run(JSON.stringify(done), id);
    changes.push(`evidence ${done.length} of ${needed.length} collected`);
  }
  if (body.outcome !== undefined) {
    if (!locked) throw new HttpError(400, 'Record an outcome only after the appeal is marked as filed.');
    if (body.outcome === null) {
      db.prepare('UPDATE deductions SET outcome = NULL, recovered_amount = 0 WHERE id = ?').run(id);
      changes.push('outcome cleared');
    } else {
      if (!OUTCOMES.includes(body.outcome)) throw new HttpError(400, 'Unknown outcome.');
      const recovered = body.outcome === 'won' ? d.amount : body.outcome === 'lost' ? 0 : Number(body.recovered_amount);
      if (!Number.isFinite(recovered) || recovered < 0 || recovered > d.amount) throw new HttpError(400, 'Recovered amount must be between 0 and the deducted amount.');
      db.prepare('UPDATE deductions SET outcome = ?, recovered_amount = ? WHERE id = ?').run(body.outcome, recovered, id);
      changes.push(`outcome ${body.outcome}, recovered ${recovered}`);
    }
  }
  if (!changes.length) throw new HttpError(400, 'Nothing to update.');
  audit('reviewed', 'deduction', id, changes.join('; '));
  return claimDetail(d.claim_id);
}

function confirmMany(ids) {
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'No lines selected.');
  const upd = db.prepare("UPDATE deductions SET review_status = 'confirmed' WHERE id = ? AND review_status = 'pending'");
  let n = 0;
  tx(() => { for (const id of ids) n += Number(upd.run(Number(id)).changes); });
  audit('reviewed', 'deduction', null, `${n} lines confirmed in bulk`);
  return { confirmed: n };
}

async function createAppeal(claimId) {
  const { claim, appeal } = claimDetail(claimId);
  if (appeal && appeal.status === 'filed') throw new HttpError(400, 'This claim already has a filed appeal.');
  const rows = db.prepare('SELECT * FROM deductions WHERE claim_id = ? ORDER BY id').all(claimId);
  const included = rows.filter(d => isContestable(d) && d.review_status !== 'pending');
  if (!included.length) throw new HttpError(400, 'Confirm at least one deduction as recoverable before drafting an appeal.');
  const found = findingsFor(claim, rows);
  for (const d of included) {
    const f = found.get(d.id);
    if (f && f.excess > 0) { d.contested_amount = f.excess; d.rationale = f.explanation; if (f.evidence.length) d.evidence_needed = JSON.stringify(f.evidence); }
  }
  const draft = await draftAppeal(claim, included, getSettings().hospital_name);
  tx(() => {
    if (appeal) db.prepare('DELETE FROM appeals WHERE id = ?').run(appeal.id);
    const r = db.prepare('INSERT INTO appeals (claim_id, body, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(claimId, draft.body, 'draft', draft.source, now(), now());
    const appealId = Number(r.lastInsertRowid);
    const set = db.prepare('UPDATE deductions SET appeal_id = ? WHERE id = ?');
    for (const d of included) set.run(appealId, d.id);
    audit('drafted', 'appeal', appealId, `${included.length} deductions, ${draft.source}`);
  });
  return claimDetail(claimId);
}

function updateAppeal(id, body) {
  const a = db.prepare('SELECT * FROM appeals WHERE id = ?').get(id);
  if (!a) throw new HttpError(404, 'Appeal not found.');
  if (a.status === 'filed') throw new HttpError(400, 'A filed appeal cannot be changed.');
  const changes = [];
  if (body.body !== undefined) {
    const text = String(body.body);
    if (!text.trim()) throw new HttpError(400, 'The appeal letter cannot be empty.');
    db.prepare('UPDATE appeals SET body = ?, updated_at = ? WHERE id = ?').run(text, now(), id);
    changes.push('letter edited');
  }
  if (body.status !== undefined) {
    if (!APPEAL_STATUSES.includes(body.status)) throw new HttpError(400, 'Unknown status.');
    if (body.status === 'filed' && a.status !== 'approved') throw new HttpError(400, 'Approve the letter before marking it as filed.');
    const current = db.prepare('SELECT body FROM appeals WHERE id = ?').get(id).body;
    if (body.status !== 'draft' && /\[[^\]]+\]/.test(current)) throw new HttpError(400, 'The letter still has bracketed placeholders. Fill them in or remove them before approving.');
    db.prepare('UPDATE appeals SET status = ?, filed_at = ?, updated_at = ? WHERE id = ?').run(body.status, body.status === 'filed' ? now() : null, now(), id);
    changes.push(`status ${body.status}`);
  }
  if (!changes.length) throw new HttpError(400, 'Nothing to update.');
  audit('updated', 'appeal', id, changes.join('; '));
  return claimDetail(a.claim_id);
}

function updateSettings(body) {
  const set = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  if (body.hospital_name !== undefined) set.run(String(body.hospital_name).slice(0, 200) || 'Hospital', 'hospital_name');
  if (body.reviewer_name !== undefined) set.run(String(body.reviewer_name).slice(0, 100) || 'Reviewer', 'reviewer_name');
  if (body.success_fee_percent !== undefined) {
    const p = Number(body.success_fee_percent);
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new HttpError(400, 'Success fee must be between 0 and 100 percent.');
    set.run(String(p), 'success_fee_percent');
  }
  audit('updated', 'settings', null, Object.keys(body).join(', '));
  return getSettings();
}

function loadSamples() {
  const dir = path.join(here, 'samples');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()
    .map(f => ({ name: f, type: 'text/plain', dataBase64: fs.readFileSync(path.join(dir, f)).toString('base64') }));
  return ingest(files);
}

function exportCsv() {
  // Prefix cells that a spreadsheet would run as a formula.
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && typeof v !== 'number') s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['Claim no', 'Payer', 'Procedure', 'Line item', 'Amount', 'Payer stated reason', 'Category', 'Verdict', 'Confidence', 'Review status', 'Appeal status', 'Outcome', 'Recovered'];
  const rows = allDeductions().map(d => [d.claim_no || d.file_name, d.payer, d.procedure_name, d.line_item, d.amount, d.stated_reason, d.category_label, d.verdict, d.confidence, d.review_status, d.appeal_status || '', d.outcome || '', d.recovered_amount]);
  return [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}

// ---------- Router ----------
async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const m = req.method;

  if (m === 'GET' && STATIC[p]) {
    const [file, type] = STATIC[p];
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(path.join(here, 'public', file)));
  }
  if (!p.startsWith('/api/')) throw new HttpError(404, 'Not found.');

  let mm;
  if (m === 'GET' && p === '/api/summary') return send(res, 200, summary());
  if (m === 'GET' && p === '/api/claims') return send(res, 200, listClaims());
  if (m === 'GET' && p === '/api/deductions') return send(res, 200, allDeductions());
  if (m === 'GET' && p === '/api/knowledge') return send(res, 200, knowledge());
  if (m === 'GET' && p === '/api/prices') return send(res, 200, priceAnalytics());
  if (m === 'GET' && p === '/api/payer-rules') return send(res, 200, rulesOverview());
  if (m === 'GET' && p === '/api/prefiling') return send(res, 200, prefilingList());
  if (m === 'GET' && p === '/api/registry') return send(res, 200, { ...registrySummary(), bill_categories: BILL_CATEGORIES });
  if (m === 'GET' && p === '/api/audit') return send(res, 200, db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all());
  if (m === 'GET' && p === '/api/meta') return send(res, 200, { verdicts: VERDICTS, outcomes: OUTCOMES, categories: CATEGORY_KEYS.map(k => ({ key: k, label: CATEGORIES[k].label })) });
  if (m === 'GET' && p === '/api/export.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="deductions.csv"' });
    return res.end('﻿' + exportCsv());
  }
  if (m === 'PUT' && p === '/api/settings') return send(res, 200, updateSettings(await readJson(req)));
  if (m === 'POST' && p === '/api/claims/upload') return send(res, 200, await ingest((await readJson(req)).files));
  if (m === 'POST' && p === '/api/samples/load') return send(res, 200, await loadSamples());
  if (m === 'POST' && p === '/api/deductions/confirm') return send(res, 200, confirmMany((await readJson(req)).ids));
  if ((mm = p.match(/^\/api\/claims\/(\d+)$/))) {
    if (m === 'GET') return send(res, 200, claimDetail(Number(mm[1])));
    if (m === 'DELETE') {
      if (!claimRow(Number(mm[1]))) throw new HttpError(404, 'Claim not found.');
      db.prepare('DELETE FROM claims WHERE id = ?').run(Number(mm[1]));
      audit('deleted', 'claim', Number(mm[1]), null);
      return send(res, 200, { ok: true });
    }
  }
  if (m === 'POST' && (mm = p.match(/^\/api\/claims\/(\d+)\/prefiling$/))) return send(res, 200, setPrefilingFlag(Number(mm[1]), await readJson(req)));
  if (m === 'POST' && (mm = p.match(/^\/api\/claims\/(\d+)\/submit$/))) return send(res, 200, submitClaim(Number(mm[1])));
  if (m === 'PATCH' && (mm = p.match(/^\/api\/claims\/(\d+)$/))) return send(res, 200, updateClaim(Number(mm[1]), await readJson(req)));
  if (m === 'POST' && (mm = p.match(/^\/api\/claims\/(\d+)\/appeal$/))) return send(res, 200, await createAppeal(Number(mm[1])));
  if (m === 'PATCH' && (mm = p.match(/^\/api\/deductions\/(\d+)$/))) return send(res, 200, updateDeduction(Number(mm[1]), await readJson(req)));
  if (m === 'PUT' && (mm = p.match(/^\/api\/appeals\/(\d+)$/))) return send(res, 200, updateAppeal(Number(mm[1]), await readJson(req)));
  throw new HttpError(404, 'Not found.');
}

http.createServer((req, res) => {
  route(req, res).catch(e => {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message || 'Server error' });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`ClaimSetu running at http://localhost:${PORT}  (${claudeConfigured() ? 'Claude extraction on' : 'demo mode: no Claude credentials'})`);
});
