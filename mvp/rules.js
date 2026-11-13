// Starter deduction taxonomy.
// These defaults are working assumptions to be corrected by reviewers and by real outcomes.
// They are not legal or policy advice: the actual policy wording and hospital tariff always win.

export const VERDICTS = ['recoverable', 'partly_recoverable', 'not_recoverable', 'needs_review'];

export const CATEGORIES = {
  documentation_missing: {
    label: 'Missing document',
    verdict: 'recoverable', confidence: 0.8,
    rationale: 'The payer cut this for a missing document, not because the charge is excluded. It is usually paid once the document is supplied.',
    evidence: ['The specific report or document the payer says was missing'],
    match: /not submitted|not provided|not attached|missing|not received|report awaited|without (bill|report|prescription)/i
  },
  medical_necessity: {
    label: 'Medical necessity or length of stay',
    verdict: 'recoverable', confidence: 0.6,
    rationale: 'The payer questioned clinical need. This can be contested with the treating doctor\'s justification and the clinical notes.',
    evidence: ['Treating doctor\'s written justification', 'Clinical notes or vitals chart for the disputed days'],
    match: /not justified|medically necessary|medical necessity|not indicated|prolonged stay|extended stay|length of stay|not related to/i
  },
  tariff_excess: {
    label: 'Above agreed tariff or package',
    verdict: 'needs_review', confidence: 0.5,
    rationale: 'Recoverable only if the hospital billed at the rate in its signed agreement with this payer. Compare the bill line with the agreed tariff.',
    evidence: ['Relevant page of the signed tariff or agreement with the payer', 'Itemised bill line'],
    match: /tariff|agreed rate|package rate|schedule of charges|\bSOC\b|in excess of agreed|above package|mou rate/i
  },
  reasonable_customary: {
    label: 'Reasonable and customary charges',
    verdict: 'recoverable', confidence: 0.55,
    rationale: 'A "reasonable and customary" cut is the payer\'s own judgement. If an agreed tariff exists and was followed, it can be contested.',
    evidence: ['Agreed tariff for the procedure', 'Itemised bill'],
    match: /reasonable and customary|reasonable & customary|\bR ?& ?C\b|customary/i
  },
  room_rent_proportionate: {
    label: 'Room rent and proportionate deduction',
    verdict: 'needs_review', confidence: 0.5,
    rationale: 'Valid if the policy has a room rent cap and the patient chose a higher category. Contestable if the cap was misread or applied to charges that do not vary by room.',
    evidence: ['Policy schedule showing the room rent limit', 'Room category actually billed'],
    match: /room rent|proportionate|room category|eligible room/i
  },
  duplicate_or_calculation: {
    label: 'Duplicate billing or calculation',
    verdict: 'needs_review', confidence: 0.5,
    rationale: 'Check the bill. If the line was genuinely billed once, this is recoverable; if it was billed twice, the cut is correct.',
    evidence: ['Itemised bill showing the line appears once'],
    match: /duplicate|billed twice|double billing|calculation|arithmetic/i
  },
  copay_deductible: {
    label: 'Co-pay or deductible',
    verdict: 'not_recoverable', confidence: 0.9,
    rationale: 'Co-pay and deductibles are the patient\'s share under the policy. Collect from the patient, not the payer.',
    evidence: [],
    match: /co-?pay|co-?payment|deductible/i
  },
  sub_limit: {
    label: 'Sub-limit or sum insured',
    verdict: 'not_recoverable', confidence: 0.8,
    rationale: 'A policy sub-limit or exhausted sum insured is a contractual cap. Contest only if the wrong limit was applied.',
    evidence: ['Policy schedule, only if the limit looks wrong'],
    match: /sub-?limit|capping|limit exhausted|sum insured|policy limit/i
  },
  non_payable_items: {
    label: 'Non-payable items',
    verdict: 'not_recoverable', confidence: 0.7,
    rationale: 'Usually a valid exclusion under the policy\'s non-payable list. Worth a look only if the item should have been part of the procedure charge.',
    evidence: [],
    match: /non-?payable|non-?medical|consumable|not payable|admin(istrative)? charges|registration charges/i
  },
  policy_exclusion: {
    label: 'Policy exclusion or waiting period',
    verdict: 'not_recoverable', confidence: 0.7,
    rationale: 'Exclusions and waiting periods are policy terms. Contest only if the payer applied an exclusion that does not fit the diagnosis.',
    evidence: [],
    match: /exclusion|excluded|not covered|waiting period|pre-?existing/i
  },
  other: {
    label: 'Other or unclear',
    verdict: 'needs_review', confidence: 0.3,
    rationale: 'The stated reason does not match a known pattern. A reviewer should read the letter.',
    evidence: [],
    match: null
  }
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

// Rule-based classification used in demo mode (no Claude). Order matters: more specific first.
export function classifyByRules(lineItem, statedReason) {
  const text = `${statedReason || ''} ${lineItem || ''}`;
  for (const key of CATEGORY_KEYS) {
    const c = CATEGORIES[key];
    if (c.match && c.match.test(statedReason || '')) return fromCategory(key);
  }
  for (const key of CATEGORY_KEYS) {
    const c = CATEGORIES[key];
    if (c.match && c.match.test(text)) return fromCategory(key);
  }
  return fromCategory('other');
}

function fromCategory(key) {
  const c = CATEGORIES[key];
  return { category: key, verdict: c.verdict, confidence: c.confidence, rationale: c.rationale, evidence_needed: [...c.evidence] };
}

export function taxonomyForPrompt() {
  return CATEGORY_KEYS.map(k => `- ${k}: ${CATEGORIES[k].label}. Default view: ${CATEGORIES[k].verdict}. ${CATEGORIES[k].rationale}`).join('\n');
}
