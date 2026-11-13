// Payer rules engine.
// Each payer has one file in rules/payers/ holding its policy terms, the rates agreed with this
// hospital, and what it does not pay for. The engine works out what the payer was ENTITLED to cut
// under those terms and compares it with what it actually cut. The difference is the over-deduction.
//
// The files shipped here are synthetic. Real use needs the actual policy schedule for each patient
// and the hospital's signed tariff with each payer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEntity } from './registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'rules', 'payers');
const payers = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) })) : [];

export const payerRules = name => payers.find(p => p.payer.toLowerCase() === String(name || '').toLowerCase()) || null;
export const allPayerRules = () => payers;

const rupees = n => 'Rs. ' + Math.round(n).toLocaleString('en-IN');
const sum = (xs, f) => xs.reduce((t, x) => t + f(x), 0);
const fact = (facts, key) => facts.find(f => f.key === key)?.value ?? null;
const says = v => v != null && !/^(no|none|nil|not\b|0$)/i.test(String(v).trim());
const isRoom = l => l.category === 'room' && /room|ward|bed/i.test(l.description) && !/icu|nursing/i.test(l.description);
const duplicates = lines => { const seen = new Set(), out = []; for (const l of lines) { const k = `${l.description.toLowerCase()}|${l.quantity}|${l.unit_price}`; if (seen.has(k)) out.push(l); seen.add(k); } return out; };

function finish(rule, d, permitted, explanation, extra = {}) {
  const cut = d.amount;
  const allowed = Math.max(0, Math.min(cut, Math.round(permitted)));
  const excess = cut - allowed;
  return { rule, payer_cut: cut, permitted_cut: allowed, excess, verdict: excess <= 0 ? 'not_recoverable' : allowed <= 0 ? 'recoverable' : 'partly_recoverable', explanation, evidence: extra.evidence || [], certain: extra.certain !== false };
}

// One evaluator per kind of deduction. Each returns null when the payer file has nothing to say.
const evaluators = {
  non_payable_items(d, ctx) {
    const cats = ctx.rules.non_payable?.categories || [];
    const lines = ctx.related.filter(l => cats.includes(l.category));
    if (!cats.length || !lines.length) return null;
    const billed = sum(lines, l => l.amount);
    return finish('Non-payable items', d, billed, `The payer's terms list ${cats.join(' and ')} charges as non-payable, and ${rupees(billed)} of such charges were billed. The cut is within the terms.`);
  },
  room_rent_proportionate(d, ctx) {
    const cap = ctx.rules.policy?.room_rent_per_day;
    if (!cap) return null;
    const rooms = ctx.bill.filter(isRoom);
    if (!rooms.length) return null;
    const over = sum(rooms, l => Math.max(0, (l.unit_price || 0) - cap) * (l.quantity || 1));
    if (ctx.rules.policy.proportionate_deduction) {
      return finish('Room rent limit', d, d.amount, `The policy caps room rent at ${rupees(cap)} a day and allows proportionate deduction of associated charges. The bill shows ${rupees(over)} above the cap on room rent alone; the proportionate share needs checking by hand.`, { certain: false });
    }
    return finish('Room rent limit', d, over, `The policy caps room rent at ${rupees(cap)} a day and has no proportionate-deduction clause. Room rent billed above the cap comes to ${rupees(over)}, so the payer could cut ${rupees(over)}, not ${rupees(d.amount)}.`, { evidence: ['Policy schedule showing the room rent limit and no proportionate clause'] });
  },
  agreed_rates(d, ctx) {
    const rates = new Map((ctx.rules.agreed_rates || []).map(r => [r.entity_id, r.rate]));
    const priced = ctx.related.filter(l => l.entity_id && rates.has(l.entity_id));
    if (!priced.length) {
      if (!ctx.related.length) return null;
      return finish('Agreed rates', d, 0, `The tariff on file with this payer has no agreed rate for the item this cut refers to, so there is no stated basis for reducing it.`, { evidence: ['Signed tariff showing no rate for this item', 'Itemised bill line'], certain: false });
    }
    const over = sum(priced, l => Math.max(0, (l.unit_price || 0) - rates.get(l.entity_id)) * (l.quantity || 1));
    const detail = priced.map(l => `${l.canonical_name} billed at ${rupees(l.unit_price)} against an agreed ${rupees(rates.get(l.entity_id))}`).join('; ');
    return finish('Agreed rates', d, over, `${detail}. The amount above the agreed rate is ${rupees(over)}, so that is the most the payer could cut.`, { evidence: ['Relevant page of the signed tariff', 'Itemised bill line'] });
  },
  documentation_missing(d, ctx) {
    const req = (ctx.rules.required_documents || []).find(r => ctx.related.some(l => l.entity_id === r.when_billed));
    if (!req) return null;
    const sent = fact(ctx.facts, 'histopathology_sent');
    const note = req.when_billed === 'histopathology' && says(sent) ? ` The discharge summary records that the specimen was sent ("${sent}").` : '';
    return finish('Required documents', d, 0, `The charge itself is payable; the payer withheld it because this document was not in the claim file: ${req.document}.${note} Sending the document should release the full amount.`, { evidence: [req.document] });
  },
  medical_necessity(d, ctx) {
    const proc = ctx.procedure && (ctx.rules.stay || []).find(s => s.procedure === ctx.procedure.entity_id);
    if (!proc) return null;
    const complications = fact(ctx.facts, 'complications');
    const acute = fact(ctx.facts, 'acute_presentation');
    if (/icu|intensive/i.test(d.line_item + ' ' + (d.stated_reason || ''))) {
      const reasons = [says(complications) && `a documented complication ("${complications}")`, says(acute) && 'an acute presentation'].filter(Boolean);
      if (!reasons.length) return finish('Stay and ICU', d, d.amount, `The payer's terms pay for ICU only when a complication or acute presentation is documented, and the discharge summary records neither.`, { certain: false });
      return finish('Stay and ICU', d, 0, `The payer's terms pay for ICU when clinically indicated. The discharge summary records ${reasons.join(' and ')}, which supports the ICU day.`, { evidence: ['Discharge summary', 'ICU notes for the day in question', "Treating doctor's justification"] });
    }
    const los = Number(fact(ctx.facts, 'length_of_stay_days'));
    if (!los) return null;
    const extra = los - proc.max_days;
    if (extra <= 0) return finish('Stay and ICU', d, 0, `The stay was ${los} days, within the ${proc.max_days} days the payer's terms allow for this procedure.`, { evidence: ['Discharge summary'] });
    if (says(complications)) return finish('Stay and ICU', d, 0, `The stay was ${los} days against a usual ${proc.max_days}. The discharge summary documents a complication ("${complications}"), which the payer's terms accept as grounds for a longer stay.`, { evidence: ['Discharge summary', "Treating doctor's justification for the extra days", 'Clinical notes for those days'] });
    return finish('Stay and ICU', d, d.amount, `The stay was ${los} days against a usual ${proc.max_days}, and the discharge summary documents no complication to justify the extra ${extra}.`, { certain: false });
  },
  copay_deductible(d, ctx) {
    const pctg = ctx.rules.policy?.copay_percent;
    if (pctg == null || !ctx.claim.claimed_amount) return null;
    const due = ctx.claim.claimed_amount * pctg / 100;
    return finish('Co-payment', d, due, pctg ? `The policy carries a ${pctg}% co-payment. On ${rupees(ctx.claim.claimed_amount)} claimed that is ${rupees(due)}, which is the patient's share.` : `The policy on file carries no co-payment, so this cut has no basis in the terms.`);
  },
  sub_limit(d, ctx) {
    const lim = (ctx.rules.policy?.sub_limits || []).find(s => s.domain === ctx.claim.clinical_domain || (ctx.procedure && s.procedure === ctx.procedure.entity_id));
    if (!lim || !ctx.claim.claimed_amount) return null;
    const over = Math.max(0, ctx.claim.claimed_amount - lim.limit);
    return finish('Sub-limit', d, over, `The policy limits ${lim.label} to ${rupees(lim.limit)}. ${rupees(ctx.claim.claimed_amount)} was claimed, so ${rupees(over)} falls outside the limit.`);
  },
  duplicate_or_calculation(d, ctx) {
    const dup = duplicates(ctx.related);
    if (!dup.length) return ctx.related.length ? finish('Duplicate billing', d, 0, `The bill shows this charge only once, so the payer's claim of duplicate billing is not supported.`, { evidence: ['Itemised bill showing the line once'] }) : null;
    const amt = sum(dup, l => l.amount);
    return finish('Duplicate billing', d, amt, `The bill does carry this line twice (${rupees(amt)} repeated). The cut is correct; fix the bill.`);
  },
  policy_exclusion(d, ctx) {
    const hit = (ctx.rules.exclusions || []).find(x => new RegExp(x.match, 'i').test(d.line_item));
    if (!hit) return null;
    return finish('Policy exclusion', d, d.amount, `The payer's terms exclude ${hit.label}.`);
  }
};
const BY_CATEGORY = { non_payable_items: 'non_payable_items', room_rent_proportionate: 'room_rent_proportionate', tariff_excess: 'agreed_rates', reasonable_customary: 'agreed_rates',
  documentation_missing: 'documentation_missing', medical_necessity: 'medical_necessity', copay_deductible: 'copay_deductible', sub_limit: 'sub_limit', duplicate_or_calculation: 'duplicate_or_calculation', policy_exclusion: 'policy_exclusion' };

// Finding for each deduction on a claim. `relatedOf` supplies the bill lines a deduction refers to.
export function evaluateClaim(claim, bill, facts, deductions, relatedOf) {
  const rules = payerRules(claim.payer);
  const out = new Map();
  if (!rules) return out;
  const procedure = claim.procedure_name ? resolveEntity(claim.procedure_name, 'procedure') : null;
  for (const d of deductions) {
    const fn = evaluators[BY_CATEGORY[d.category]];
    if (!fn) continue;
    const f = fn(d, { rules, claim, bill, facts, procedure, related: relatedOf(d) });
    if (f) out.set(d.id, f);
  }
  return out;
}

// What the rules would flag on a bill before it is filed.
// Each flag says what to do about it:
//   collect - the payer will not pay this; bill the patient instead
//   fix     - the bill itself is wrong; correct it
//   attach  - payable, but only with a supporting document; "risk" is what is lost without it
export function preSubmission(claim, bill, facts) {
  const rules = payerRules(claim.payer);
  if (!rules || !bill.length) return [];
  const flags = [];
  const add = (key, kind, action, amount, risk, text) => flags.push({ key, kind, action, amount: amount == null ? null : Math.round(amount), risk: risk == null ? null : Math.round(risk), text });
  const procedure = claim.procedure_name ? resolveEntity(claim.procedure_name, 'procedure') : null;
  const billed = sum(bill, l => l.amount);
  const claimed = claim.claimed_amount || billed;

  const cats = rules.non_payable?.categories || [];
  const np = bill.filter(l => cats.includes(l.category));
  if (np.length) add('non_payable', 'Non-payable items', 'collect', sum(np, l => l.amount), null, `${np.map(l => '"' + l.description + '"').join(', ')}: this payer does not pay for these. Move them to the patient's bill.`);

  const cap = rules.policy?.room_rent_per_day;
  const rooms = bill.filter(isRoom);
  if (cap) { const over = sum(rooms, l => Math.max(0, (l.unit_price || 0) - cap) * (l.quantity || 1)); if (over) add('room_rent', 'Room rent above the policy cap', 'collect', over, null, `Room rent is billed above the policy cap of ${rupees(cap)} a day. Collect the difference from the patient.`); }

  const rates = new Map((rules.agreed_rates || []).map(r => [r.entity_id, r.rate]));
  for (const l of bill) if (l.entity_id && rates.has(l.entity_id) && l.unit_price > rates.get(l.entity_id)) add('rate:' + l.entity_id, 'Above the agreed rate', 'fix', (l.unit_price - rates.get(l.entity_id)) * (l.quantity || 1), null, `${l.canonical_name} is billed at ${rupees(l.unit_price)} against an agreed ${rupees(rates.get(l.entity_id))}. Bill at the agreed rate, or attach the approval for the higher one.`);

  const dup = duplicates(bill);
  if (dup.length) add('duplicate', 'Duplicate line', 'fix', sum(dup, l => l.amount), null, `${dup.map(l => '"' + l.description + '"').join(', ')} appears twice with the same quantity and price. Remove the repeat, or confirm both are genuine.`);

  if (rules.policy?.copay_percent) add('copay', 'Co-payment', 'collect', claimed * rules.policy.copay_percent / 100, null, `The policy carries a ${rules.policy.copay_percent}% co-payment. Collect it from the patient at discharge.`);

  const lim = (rules.policy?.sub_limits || []).find(x => x.domain === claim.clinical_domain || (procedure && x.procedure === procedure.entity_id));
  if (lim && claimed > lim.limit) add('sub_limit', 'Above the policy sub-limit', 'collect', claimed - lim.limit, null, `${lim.label} is limited to ${rupees(lim.limit)}. The amount above it falls to the patient.`);

  const stay = procedure && (rules.stay || []).find(x => x.procedure === procedure.entity_id);
  const los = Number(fact(facts, 'length_of_stay_days'));
  if (stay && los > stay.max_days) {
    const perDay = Math.max(0, ...rooms.map(l => l.unit_price || 0));
    const documented = says(fact(facts, 'complications'));
    add('stay', 'Stay longer than usual', 'attach', null, (los - stay.max_days) * perDay, `Stay of ${los} days against a usual ${stay.max_days}. ${documented ? 'The summary documents a complication; attach' : 'The summary documents no complication. Attach'} the treating doctor's justification for the extra ${los - stay.max_days === 1 ? 'day' : 'days'}.`);
  }
  if (bill.some(l => /icu|intensive/i.test(l.description)) && !says(fact(facts, 'complications')) && !says(fact(facts, 'acute_presentation'))) {
    add('icu', 'ICU without a documented reason', 'attach', null, sum(bill.filter(l => /icu|intensive/i.test(l.description)), l => l.amount), 'ICU is billed but the summary records no complication or acute presentation. Attach the ICU notes and the reason for admission to ICU.');
  }
  for (const r of rules.required_documents || []) {
    const lines = bill.filter(l => l.entity_id === r.when_billed);
    if (lines.length) add('doc:' + r.when_billed, 'Document to attach', 'attach', null, sum(lines, l => l.amount), `${r.document} must be in the claim file, or the charge will be withheld.`);
  }
  return flags;
}
