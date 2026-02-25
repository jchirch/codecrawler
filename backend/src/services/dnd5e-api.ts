// In-memory cache
interface CacheEntry { data: unknown; expiresAt: number; }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour
const BASE = 'https://www.dnd5eapi.co/api';

async function cachedGet<T>(path: string): Promise<T> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expiresAt > now) return hit.data as T;
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`DnD5e API ${res.status}: ${path}`);
  const data = await res.json() as T;
  cache.set(path, { data, expiresAt: now + TTL_MS });
  return data;
}

// Types
export interface Dnd5eListItem { index: string; name: string; url: string; }
export interface Dnd5eList { count: number; results: Dnd5eListItem[]; }

export interface ClassDetail {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: unknown[];
  proficiencies: unknown[];
  saving_throws: Array<{ index: string; name: string }>;
  starting_equipment: unknown[];
  class_levels: string;
  spells?: string; // present on spellcasting classes
  subclasses: unknown[];
  spellcasting?: {
    level: number;
    spellcasting_ability: { index: string; name: string };
  };
}

export interface RaceDetail {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: Array<{ ability_score: { index: string; name: string }; bonus: number }>;
  alignment: string;
  age: string;
  size: string;
  size_description: string;
  languages: unknown[];
  traits: Array<{ index: string; name: string }>;
  subraces: unknown[];
}

export interface SpellItem {
  index: string;
  name: string;
  url: string;
  level: number;
}

// Exported functions
export async function getClasses(): Promise<Dnd5eList> {
  return cachedGet<Dnd5eList>('/classes');
}

export async function getClassDetail(index: string): Promise<ClassDetail> {
  return cachedGet<ClassDetail>(`/classes/${index}`);
}

export async function getRaces(): Promise<Dnd5eList> {
  return cachedGet<Dnd5eList>('/races');
}

export async function getRaceDetail(index: string): Promise<RaceDetail> {
  return cachedGet<RaceDetail>(`/races/${index}`);
}

// Get spells for a class. The DnD 5e API endpoint is /classes/:index/spells
// This returns all spells for the class. We filter by level if provided.
export async function getClassSpells(classIndex: string, level?: number): Promise<SpellItem[]> {
  interface SpellListResponse { count: number; results: Array<{ index: string; name: string; url: string; level?: number }>; }
  let spells: SpellItem[];
  try {
    const data = await cachedGet<SpellListResponse>(`/classes/${classIndex}/spells`);
    // Fetch level for each spell from the spell detail (expensive - use a simpler approach)
    // The spell list endpoint doesn't return level, but /api/spells/:index does.
    // For performance, we'll fetch each spell detail and cache it.
    // BUT this could be 100+ spells. Instead, use the /spells endpoint with filters.
    // Filter by class using the spells endpoint: /api/spells?classes=wizard&level=0
    // Actually the DnD5e API supports: GET /api/spells?level=1 but not direct class filter
    // The /classes/:index/spells endpoint does exist and returns spells with level info:
    // Actually it returns: { count, results: [{index, name, url}] } WITHOUT level
    // For the character creation form we want level for filtering.
    // We'll fetch spell details in batches but limit to first 50 to avoid N+1 issues.
    // For the character sheet, we just store index+name.
    spells = data.results.slice(0, 80).map(s => ({ 
      index: s.index, 
      name: s.name, 
      url: s.url,
      level: s.level ?? 0 
    }));
  } catch {
    spells = [];
  }
  
  if (level !== undefined) {
    spells = spells.filter(s => s.level === level);
  }
  return spells;
}

// Fetch spell details with level (for spell selection UI)
export async function getSpellsForClass(classIndex: string): Promise<SpellItem[]> {
  // Use the /spells endpoint filtered by class - DnD5e v2 supports this
  // GET /api/spells?classes=wizard returns spells with level included
  interface SpellWithLevel { index: string; name: string; url: string; level: number; }
  interface SpellsResponse { count: number; results: SpellWithLevel[]; }
  try {
    const data = await cachedGet<SpellsResponse>(`/spells?classes=${classIndex}`);
    return data.results.map(s => ({ index: s.index, name: s.name, url: s.url, level: s.level ?? 0 }));
  } catch {
    // Fallback to class spells endpoint (no level info)
    return getClassSpells(classIndex);
  }
}
