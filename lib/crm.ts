// Brand-outreach CRM data layer — persisted in Vercel KV (same store as analytics).
// Single-admin, low write volume, so the whole brand list lives under one key and
// each mutation rewrites it. Simple + transactional enough for one user.

import { SEED_BRANDS } from './crmSeed';

export type Stage =
  | 'new'          // shortlisted, not started
  | 'researching'  // finding contacts
  | 'contacts'     // contacts found, not yet drafted
  | 'drafted'      // email drafted, not sent
  | 'sent'         // outreach sent
  | 'replied'      // they replied
  | 'won'          // deal/partnership
  | 'passed';      // not a fit / declined

export const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'new',         label: 'New',         color: '#64748b' },
  { key: 'researching', label: 'Researching', color: '#0ea5e9' },
  { key: 'contacts',    label: 'Contacts',    color: '#6366f1' },
  { key: 'drafted',     label: 'Drafted',     color: '#a855f7' },
  { key: 'sent',        label: 'Sent',        color: '#f59e0b' },
  { key: 'replied',     label: 'Replied',     color: '#10b981' },
  { key: 'won',         label: 'Won',         color: '#16a34a' },
  { key: 'passed',      label: 'Passed',      color: '#94a3b8' },
];

export interface Contact {
  id: string;
  name: string;         // "Jane Doe" or the role, e.g. "Partnerships (role inbox)"
  title: string;        // e.g. "Head of Influencer Marketing"
  email: string;
  kind: 'named' | 'role';
  verified: boolean;    // reserved for a future Hunter/Apollo verify step
  region?: string;      // US / UK / EU
  linkedin?: string;
  note?: string;        // e.g. "email pattern guessed: first.last@ — unverified"
}

export interface Draft {
  subject: string;
  body: string;
  contactId?: string;
  updatedAt: number;
}

export interface Brand {
  id: string;
  name: string;
  domain: string;
  category: string;
  tier: 'A' | 'B' | 'C';
  region: string;       // primary market: US / UK / Global
  fit: string;          // one-line why-this-brand-fits-diez
  stage: Stage;
  contacts: Contact[];
  draft?: Draft;
  notes?: string;
  updatedAt: number;
}

const KEY = 'crm:brands:v1';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Turn a lean seed row into a full Brand record.
export function hydrateSeed(): Brand[] {
  const now = Date.now();
  return SEED_BRANDS.map(b => ({
    id: slug(b.name),
    name: b.name,
    domain: b.domain,
    category: b.category,
    tier: b.tier,
    region: b.region,
    fit: b.fit,
    stage: 'new' as Stage,
    contacts: [],
    updatedAt: now,
  }));
}

async function kvClient() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function getBrands(): Promise<Brand[]> {
  const kv = await kvClient();
  const data = await kv.get<Brand[]>(KEY);
  return Array.isArray(data) ? data : [];
}

export async function saveBrands(brands: Brand[]): Promise<void> {
  const kv = await kvClient();
  await kv.set(KEY, brands);
}

// Seed the store from the curated list. Merge mode keeps any brand the user already
// has (by id) and only adds new seed brands, so re-seeding never wipes CRM progress.
export async function seedBrands(mode: 'merge' | 'replace' = 'merge'): Promise<Brand[]> {
  const seed = hydrateSeed();
  if (mode === 'replace') { await saveBrands(seed); return seed; }
  const existing = await getBrands();
  if (!existing.length) { await saveBrands(seed); return seed; }
  const have = new Set(existing.map(b => b.id));
  const merged = [...existing, ...seed.filter(b => !have.has(b.id))];
  await saveBrands(merged);
  return merged;
}

export async function updateBrand(id: string, patch: Partial<Brand>): Promise<Brand | null> {
  const brands = await getBrands();
  const i = brands.findIndex(b => b.id === id);
  if (i === -1) return null;
  brands[i] = { ...brands[i], ...patch, id: brands[i].id, updatedAt: Date.now() };
  await saveBrands(brands);
  return brands[i];
}

export async function addBrand(b: Omit<Brand, 'stage' | 'contacts' | 'updatedAt'> & Partial<Brand>): Promise<Brand> {
  const brands = await getBrands();
  const brand: Brand = {
    stage: 'new', contacts: [], updatedAt: Date.now(),
    ...b,
    id: b.id || slug(b.name),
  } as Brand;
  const i = brands.findIndex(x => x.id === brand.id);
  if (i === -1) brands.unshift(brand); else brands[i] = brand;
  await saveBrands(brands);
  return brand;
}

// Concise media-kit context injected into every AI prompt (contacts + email drafts).
export const DIEZ_PROFILE = `Diez (diez.gg) is a top Call of Duty: Warzone / FPS creator.
- Total audience ~1.7M across platforms. Gaming: TikTok @diez.gg ~1.4M, YouTube @imDiez ~104K, Instagram ~44K, plus Facebook & Twitch.
- 150M+ views/year on gaming; ~12.5M views/month. Also a fast-growing football brand (@diez.ball).
- Warzone / FPS focused: loadouts, meta, gameplay, launches. UK-based creator, English-speaking US+UK audience, core demo 16-34 male gamers.
- Past brand work: Call of Duty, Razer, PlayStation, Epic Games, PUBG, Thunderpick, EklipseGG.
- Managed by GLTCH Group; business contact hello@diez.gg.`;
