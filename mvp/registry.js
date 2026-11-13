// Schema registry and entity catalogues.
// Adding a clinical domain means adding a JSON file to schemas/; adding a drug, device or
// procedure means adding an entry to catalogues/. No code changes are needed for either.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const readDir = dir => fs.readdirSync(path.join(here, dir)).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(here, dir, f), 'utf8')));

const schemas = readDir('schemas');
export const core = schemas.find(s => s.key === 'core');
export const domains = schemas.filter(s => s.key !== 'core').map(s => ({ ...s, re: new RegExp(s.match, 'i') }));
export const DOMAIN_KEYS = domains.map(d => d.key);

export const domainLabel = key => domains.find(d => d.key === key)?.label || 'General';

// Properties that apply to an admission in this domain: the core set plus the domain's own.
export function propertiesFor(domainKey) {
  const d = domains.find(x => x.key === domainKey);
  return [...core.properties.map(p => ({ ...p, group: 'core' })), ...(d ? d.properties.map(p => ({ ...p, group: d.key })) : [])];
}

export function classifyDomain(text) {
  let best = null, bestHits = 0;
  for (const d of domains) {
    const hits = (String(text).match(new RegExp(d.match, 'gi')) || []).length;
    if (hits > bestHits) { best = d.key; bestHits = hits; }
  }
  return best;
}

export const BILL_CATEGORIES = ['drug', 'device', 'procedure', 'investigation', 'room', 'professional_fee', 'consumable', 'other'];

const catalogues = readDir('catalogues').map(c => ({ ...c, entries: c.entries.map(e => ({ ...e, re: new RegExp(e.match, 'i') })) }));

// Map a bill line's wording to one canonical drug, device or procedure, if the catalogue knows it.
export function resolveEntity(description, category) {
  const ordered = [...catalogues].sort((a, b) => (b.type === category) - (a.type === category));
  for (const c of ordered) {
    const e = c.entries.find(x => x.re.test(description));
    if (e) return { entity_type: c.type, entity_id: e.id, canonical_name: e.name, entity_class: e.class };
  }
  return null;
}

export function registrySummary() {
  return {
    core: { label: core.label, properties: core.properties },
    domains: domains.map(d => ({ key: d.key, label: d.label, properties: d.properties })),
    catalogues: catalogues.map(c => ({ type: c.type, note: c.note, entries: c.entries.map(e => ({ id: e.id, name: e.name, class: e.class })) })),
    total_properties: core.properties.length + domains.reduce((s, d) => s + d.properties.length, 0)
  };
}
