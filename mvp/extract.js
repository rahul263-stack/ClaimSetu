// Two ways to read a settlement letter:
//  - Claude (when credentials are configured): any PDF, image or text letter, in any layout.
//  - Demo mode (no credentials): text files in the simple "Key: value" sample layout, classified by rules.
import { CATEGORY_KEYS, CATEGORIES, VERDICTS, classifyByRules, taxonomyForPrompt } from './rules.js';

const MODEL = 'claude-opus-5-5';

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.CLAIMS_USE_CLAUDE === '1');
}

let clientPromise;
async function getClient() {
  if (!clientPromise) {
    clientPromise = import('@anthropic-ai/sdk').then(m => ({ Anthropic: m.default, client: new m.default() }));
  }
  return clientPromise;
}

const nullable = t => ({ type: [t, 'null'] });

const AUDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['payer', 'tpa', 'claim_no', 'patient_ref', 'admission_date', 'discharge_date', 'settlement_date', 'procedure_name', 'claimed_amount', 'approved_amount', 'paid_amount', 'deductions'],
  properties: {
    payer: nullable('string'),
    tpa: nullable('string'),
    claim_no: nullable('string'),
    patient_ref: nullable('string'),
    admission_date: nullable('string'),
    discharge_date: nullable('string'),
    settlement_date: nullable('string'),
    procedure_name: nullable('string'),
    claimed_amount: nullable('number'),
    approved_amount: nullable('number'),
    paid_amount: nullable('number'),
    deductions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line_item', 'amount', 'stated_reason', 'category', 'verdict', 'confidence', 'rationale', 'evidence_needed'],
        properties: {
          line_item: { type: 'string' },
          amount: { type: 'number' },
          stated_reason: nullable('string'),
          category: { type: 'string', enum: CATEGORY_KEYS },
          verdict: { type: 'string', enum: VERDICTS },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
          evidence_needed: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

const AUDIT_SYSTEM = `You audit health-insurance settlement letters for an Indian private hospital. The hospital wants to know, for every amount the insurer or TPA deducted or disallowed from a cashless claim, whether it is worth contesting.

Read the attached settlement letter (and bill, if included) and return the claim header and one entry per deducted or disallowed line.

Use only what the document says. If a field is not in the document, return null for it; never guess a claim number, date, amount or reason. Amounts are numbers in rupees without symbols or separators. Dates are ISO (YYYY-MM-DD) when the document gives a full date. settlement_date is the date the payer settled or paid the claim. For patient_ref use the patient or member ID printed on the letter, not the patient's name.

Classify each deduction into exactly one category:
${taxonomyForPrompt()}

Then give a verdict:
- recoverable: the stated reason can be answered with evidence the hospital is likely to have.
- partly_recoverable: part of the amount is contestable and part is a valid cut.
- not_recoverable: a valid contractual cut (the patient's share, a policy cap, a listed exclusion).
- needs_review: the letter does not give enough to decide; a human must check the policy or tariff.

The default views above are starting points. Depart from them when the letter's own wording points the other way, and say why in the rationale. Confidence is 0 to 1 and should be low whenever the verdict depends on a document you have not seen (the policy schedule, the agreed tariff). The rationale is one or two plain sentences for a hospital billing reviewer. evidence_needed lists the specific documents that would win the appeal; leave it empty for not_recoverable lines.`;

const APPEAL_SYSTEM = `You draft appeal letters from an Indian private hospital to a health insurer or TPA, asking for reconsideration of deductions made from a cashless claim. A human reviewer at the hospital will edit and approve the letter before it is sent.

Write a formal, courteous, specific letter in plain text (no markdown). Structure: addressee and subject line with the claim number; a short opening stating the amount contested; then one numbered point per deduction giving the line, the amount, the payer's stated reason, and the hospital's response with the enclosure that supports it; a closing request to release the contested amount; a list of enclosures; and a signature block.

Use only the facts you are given. Never state or imply a clinical fact, diagnosis, date or figure that is not in the input. Where the response depends on evidence the hospital must still attach or on a detail you do not have, write a bracketed placeholder such as [attach treating doctor's justification] or [quote agreed tariff rate] so the reviewer can see exactly what to fill in. Do not cite specific regulations, circular numbers or clause numbers unless they appear in the input.`;

export function documentBlocks(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.dataBase64 } }];
  }
  const img = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].find(t => t === type)
    || (name.endsWith('.png') ? 'image/png' : name.match(/\.jpe?g$/) ? 'image/jpeg' : name.endsWith('.webp') ? 'image/webp' : null);
  if (img) return [{ type: 'image', source: { type: 'base64', media_type: img, data: file.dataBase64 } }];
  return [{ type: 'text', text: Buffer.from(file.dataBase64, 'base64').toString('utf8') }];
}

export async function callClaude(params) {
  const { Anthropic, client } = await getClient();
  try {
    // Server-side fallback is enabled so a safety-classifier decline is retried on another model
    // instead of failing the upload. Remove `betas` and `fallbacks` to turn it off.
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...params
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to process this document.');
    if (response.stop_reason === 'max_tokens') throw new Error('The response was cut off. The document may be too long; split it and upload the parts.');
    return response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new Error('Claude credentials were rejected. Check ANTHROPIC_API_KEY.');
    if (error instanceof Anthropic.RateLimitError) throw new Error('Claude rate limit reached. Wait a minute and try again.');
    if (error instanceof Anthropic.BadRequestError) throw new Error(`Claude rejected the request: ${error.message}`);
    if (error instanceof Anthropic.APIError) throw new Error(`Claude API error ${error.status ?? ''}: ${error.message}`);
    throw error;
  }
}

async function auditWithClaude(file) {
  const text = await callClaude({
    system: AUDIT_SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: AUDIT_SCHEMA } },
    messages: [{ role: 'user', content: [...documentBlocks(file), { type: 'text', text: 'Audit this settlement letter.' }] }]
  });
  const parsed = JSON.parse(text);
  for (const d of parsed.deductions) {
    if (!CATEGORY_KEYS.includes(d.category)) d.category = 'other';
    if (!VERDICTS.includes(d.verdict)) d.verdict = 'needs_review';
    d.confidence = Math.max(0, Math.min(1, Number(d.confidence) || 0));
  }
  return { ...parsed, source: 'claude' };
}

// ---------- Demo mode ----------
const num = v => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && String(v ?? '').match(/\d/) ? n : null;
};

export function auditByRules(text) {
  const header = {};
  const deductions = [];
  let inDeductions = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^deductions?\s*:?\s*$/i.test(line)) { inDeductions = true; continue; }
    if (inDeductions && /^[-*\d]/.test(line) && line.includes('|')) {
      const parts = line.replace(/^[-*]\s*|^\d+[.)]\s*/, '').split('|').map(s => s.trim());
      const amount = num(parts[1]);
      if (parts[0] && amount !== null) {
        deductions.push({ line_item: parts[0], amount, stated_reason: parts[2] || null, ...classifyByRules(parts[0], parts[2]) });
      }
      continue;
    }
    const m = line.match(/^([A-Za-z .]+?)\s*:\s*(.+)$/);
    if (m) { header[m[1].toLowerCase().replace(/[^a-z]/g, '')] = m[2].trim(); if (!/^deductions?$/i.test(m[1])) inDeductions = false; }
  }
  if (!deductions.length && !header.claimno) {
    throw new Error('Demo mode can only read text files in the sample layout. Set ANTHROPIC_API_KEY to read real letters, PDFs and scans.');
  }
  return {
    payer: header.payer || header.insurer || null,
    tpa: header.tpa || null,
    claim_no: header.claimno || header.claimnumber || null,
    patient_ref: header.patientref || header.patientid || header.memberid || null,
    admission_date: header.admission || header.dateofadmission || null,
    discharge_date: header.discharge || header.dateofdischarge || null,
    settlement_date: header.settlementdate || header.paymentdate || null,
    procedure_name: header.procedure || header.diagnosis || null,
    claimed_amount: num(header.claimedamount),
    approved_amount: num(header.approvedamount),
    paid_amount: num(header.paidamount),
    deductions,
    source: 'demo'
  };
}

export async function auditFile(file) {
  if (claudeConfigured()) return auditWithClaude(file);
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.txt') && !(file.type || '').startsWith('text/')) {
    throw new Error('Demo mode reads text files only. Set ANTHROPIC_API_KEY to read PDFs and scanned letters.');
  }
  return auditByRules(Buffer.from(file.dataBase64, 'base64').toString('utf8'));
}

// ---------- Appeal drafting ----------
const inr = n => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function appealFacts(claim, deductions, hospitalName) {
  return {
    hospital_name: hospitalName,
    payer: claim.payer, tpa: claim.tpa, claim_no: claim.claim_no, patient_ref: claim.patient_ref,
    admission_date: claim.admission_date, discharge_date: claim.discharge_date, procedure: claim.procedure_name,
    claimed_amount: claim.claimed_amount, approved_amount: claim.approved_amount,
    contested_total: deductions.reduce((s, d) => s + (d.contested_amount ?? d.amount), 0),
    contested_deductions: deductions.map(d => ({
      line_item: d.line_item, amount: d.contested_amount ?? d.amount, amount_cut_by_payer: d.amount, payer_stated_reason: d.stated_reason,
      category: CATEGORIES[d.category]?.label || d.category,
      hospital_position: d.rationale, reviewer_note: d.reviewer_note || null,
      evidence_to_enclose: JSON.parse(d.evidence_needed || '[]')
    }))
  };
}

function appealByTemplate(f) {
  const total = inr(f.contested_total);
  const points = f.contested_deductions.map((d, i) => {
    const ev = d.evidence_to_enclose.length ? d.evidence_to_enclose.map(e => `[attach: ${e}]`).join(' ') : '[attach supporting document]';
    return `${i + 1}. ${d.line_item} - ${inr(d.amount)}\n   Stated reason: ${d.payer_stated_reason || 'not stated'}\n   Our response: ${d.reviewer_note || d.hospital_position} ${ev}`;
  }).join('\n\n');
  const enclosures = [...new Set(f.contested_deductions.flatMap(d => d.evidence_to_enclose))];
  return `To
The Claims Manager
${f.tpa || f.payer || '[payer name]'}

Subject: Request for reconsideration of deductions - Claim No. ${f.claim_no || '[claim number]'}${f.patient_ref ? `, Patient Ref ${f.patient_ref}` : ''}

Dear Sir or Madam,

We refer to the settlement of the above cashless claim for ${f.procedure || '[procedure]'}${f.admission_date ? `, admission ${f.admission_date}` : ''}${f.discharge_date ? ` to ${f.discharge_date}` : ''}. Against a claimed amount of ${inr(f.claimed_amount)}, ${inr(f.approved_amount)} was approved. We request reconsideration of the following deductions totalling ${total}.

${points}

We request that the contested amount of ${total} be released. We are glad to provide any further clarification you need.

Enclosures:
${enclosures.length ? enclosures.map((e, i) => `${i + 1}. ${e}`).join('\n') : '1. [list enclosures]'}

Yours faithfully,

[Name and designation]
${f.hospital_name}
`;
}

export async function draftAppeal(claim, deductions, hospitalName) {
  const facts = appealFacts(claim, deductions, hospitalName);
  if (!claudeConfigured()) return { body: appealByTemplate(facts), source: 'demo' };
  const body = await callClaude({
    system: APPEAL_SYSTEM,
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: `Draft the appeal letter from these facts:\n\n${JSON.stringify(facts, null, 2)}` }]
  });
  return { body: body.trim(), source: 'claude' };
}
