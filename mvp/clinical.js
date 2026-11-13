// Reads the two documents that sit beside the settlement letter:
//  - the itemised bill (every drug, device, procedure and charge, with prices)
//  - the discharge summary (clinical facts, using the schema registry)
// Claude does the reading when credentials are configured; otherwise a simple parser reads the sample layout.
import { claudeConfigured, callClaude, documentBlocks } from './extract.js';
import { BILL_CATEGORIES, DOMAIN_KEYS, classifyDomain, propertiesFor, resolveEntity } from './registry.js';

const nullable = t => ({ type: [t, 'null'] });
const textOf = file => Buffer.from(file.dataBase64, 'base64').toString('utf8');
const isText = file => (file.name || '').toLowerCase().endsWith('.txt') || (file.type || '').startsWith('text/');
const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return /\d/.test(String(v ?? '')) && Number.isFinite(n) ? n : null; };

// ---------- What kind of document is this? ----------
const TYPE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['doc_type', 'clinical_domain'],
  properties: {
    doc_type: { type: 'string', enum: ['settlement', 'bill', 'summary', 'other'] },
    clinical_domain: { type: 'string', enum: [...DOMAIN_KEYS, 'unknown'] }
  }
};

export async function detectType(file) {
  if (!claudeConfigured()) {
    if (!isText(file)) throw new Error('Demo mode reads text files only. Set ANTHROPIC_API_KEY to read PDFs and scanned documents.');
    const head = textOf(file).slice(0, 300).toUpperCase();
    const doc_type = head.includes('ITEMISED BILL') || head.includes('ITEMIZED BILL') ? 'bill' : head.includes('DISCHARGE SUMMARY') ? 'summary' : 'settlement';
    return { doc_type, clinical_domain: doc_type === 'summary' ? classifyDomain(textOf(file)) : null };
  }
  const out = JSON.parse(await callClaude({
    system: `You sort hospital claim documents. Decide which one this is:
- settlement: a payer's settlement advice or deduction letter for a claim.
- bill: the hospital's itemised bill for an admission.
- summary: a clinical discharge summary.
- other: anything else.
Also name the clinical domain the admission belongs to, or "unknown" if you cannot tell.`,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: TYPE_SCHEMA } },
    messages: [{ role: 'user', content: [...documentBlocks(file), { type: 'text', text: 'Classify this document.' }] }]
  }));
  return { doc_type: out.doc_type, clinical_domain: out.clinical_domain === 'unknown' ? null : out.clinical_domain };
}

// ---------- Itemised bill ----------
const BILL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['claim_no', 'patient_ref', 'payer', 'lines'],
  properties: {
    claim_no: nullable('string'), patient_ref: nullable('string'), payer: nullable('string'),
    lines: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['description', 'category', 'quantity', 'unit_price', 'amount'],
      properties: { description: { type: 'string' }, category: { type: 'string', enum: BILL_CATEGORIES }, quantity: nullable('number'), unit_price: nullable('number'), amount: { type: 'number' } }
    } }
  }
};

function parseBillText(text) {
  const header = {}; const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^[-*]/.test(line) && line.includes('|')) {
      const p = line.replace(/^[-*]\s*/, '').split('|').map(s => s.trim());
      const amount = num(p[4] ?? p[3]);
      if (p[0] && amount !== null) lines.push({ description: p[0], category: BILL_CATEGORIES.includes(p[1]) ? p[1] : 'other', quantity: num(p[2]), unit_price: num(p[3]), amount });
      continue;
    }
    const m = line.match(/^([A-Za-z .]+?)\s*:\s*(.+)$/);
    if (m) header[m[1].toLowerCase().replace(/[^a-z]/g, '')] = m[2].trim();
  }
  return { claim_no: header.claimno || header.claimnumber || null, patient_ref: header.patientref || header.patientid || null, payer: header.payer || header.insurer || null, lines };
}

export async function readBill(file) {
  let bill, source;
  if (claudeConfigured()) {
    bill = JSON.parse(await callClaude({
      system: `You transcribe Indian hospital itemised bills into structured lines. Return one entry per billed line, exactly as billed: do not merge, split, correct or total lines. Amounts are rupees as plain numbers. If quantity or unit price is not printed, return null for it. Use only what the document says; return null for a claim number, patient reference or payer (the insurer or TPA named on the bill) that is not printed. Give each line one category: drug (medicines), device (implants, stents, catheters and other single-patient devices), procedure (theatre, cath lab and procedure charges), investigation (laboratory and imaging), room (room, ICU and nursing), professional_fee (doctor and anaesthetist fees), consumable (gloves, drapes and general disposables), other.`,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: BILL_SCHEMA } },
      messages: [{ role: 'user', content: [...documentBlocks(file), { type: 'text', text: 'Transcribe this bill.' }] }]
    }));
    source = 'claude';
  } else {
    bill = parseBillText(textOf(file));
    source = 'demo';
  }
  if (!bill.lines.length) throw new Error('No bill lines could be read from this document.');
  for (const l of bill.lines) {
    if (!BILL_CATEGORIES.includes(l.category)) l.category = 'other';
    Object.assign(l, resolveEntity(l.description, l.category) || { entity_type: null, entity_id: null, canonical_name: null, entity_class: null });
  }
  return { ...bill, source };
}

// ---------- Discharge summary ----------
function summarySchema(props) {
  return {
    type: 'object', additionalProperties: false, required: ['claim_no', 'patient_ref', 'properties'],
    properties: {
      claim_no: nullable('string'), patient_ref: nullable('string'),
      properties: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['key', 'value', 'quote', 'confidence'],
        properties: { key: { type: 'string', enum: props.map(p => p.key) }, value: nullable('string'), quote: nullable('string'), confidence: { type: 'number' } }
      } }
    }
  };
}

export async function readSummary(file, domainHint) {
  if (claudeConfigured()) {
    const props = propertiesFor(domainHint);
    const out = JSON.parse(await callClaude({
      system: `You extract clinical facts from Indian hospital discharge summaries for claim review. Return one entry for each property listed below that the document states.

Use only what the document says. Never infer a diagnosis, a duration or a number that is not written; leave a property out, or return null for its value, when the document is silent. For each value give "quote": the exact words from the document that support it, short enough to check at a glance. Confidence is 0 to 1 and should be low when the wording is ambiguous or you had to choose between two readings. Values are plain text; numbers as digits. For patient_ref use the printed patient or member ID, never the patient's name.

Properties:
${props.map(p => `- ${p.key}: ${p.description}`).join('\n')}`,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: summarySchema(props) } },
      messages: [{ role: 'user', content: [...documentBlocks(file), { type: 'text', text: 'Extract the clinical facts.' }] }]
    }));
    const byKey = new Map(props.map(p => [p.key, p]));
    return {
      claim_no: out.claim_no, patient_ref: out.patient_ref, domain: domainHint, source: 'claude',
      facts: out.properties.filter(f => byKey.has(f.key) && f.value != null && f.value !== '')
        .map(f => ({ key: f.key, label: byKey.get(f.key).label, group: byKey.get(f.key).group, value: String(f.value), quote: f.quote, confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)) }))
    };
  }
  // Demo mode: "Label: value" lines whose label matches a registry property.
  const text = textOf(file);
  const domain = domainHint || classifyDomain(text);
  const props = propertiesFor(domain);
  const byKey = new Map(props.map(p => [p.key, p]));
  const header = {}; const facts = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9 .\-]+?)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    header[key] = m[2].trim();
    const p = byKey.get(key);
    if (p) facts.push({ key, label: p.label, group: p.group, value: m[2].trim(), quote: raw.trim(), confidence: 0.95 });
  }
  if (!facts.length) throw new Error('No clinical facts could be read from this document.');
  return { claim_no: header.claim_no || null, patient_ref: header.patient_ref || null, domain, source: 'demo', facts };
}
