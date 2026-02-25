// Standard D&D 5e XP thresholds for levels 1-20
// Index i = level (i+1), value = XP needed to reach that level
// XP_THRESHOLDS[0] = 0 (level 1 starts at 0 XP)
export const XP_THRESHOLDS = [
  0,       // Level 1
  300,     // Level 2
  900,     // Level 3
  2700,    // Level 4
  6500,    // Level 5
  14000,   // Level 6
  23000,   // Level 7
  34000,   // Level 8
  48000,   // Level 9
  64000,   // Level 10
  85000,   // Level 11
  100000,  // Level 12
  120000,  // Level 13
  140000,  // Level 14
  165000,  // Level 15
  195000,  // Level 16
  225000,  // Level 17
  265000,  // Level 18
  305000,  // Level 19
  355000,  // Level 20
] as const;

export function getLevelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(level, 20);
}

export function getXpForLevel(level: number): number {
  const idx = Math.max(0, Math.min(level - 1, 19));
  return XP_THRESHOLDS[idx];
}

export function getXpForNextLevel(level: number): number | null {
  if (level >= 20) return null;
  return XP_THRESHOLDS[level]; // XP_THRESHOLDS[level] = threshold for level+1
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

// Spellcasting classes by index (as returned by DnD 5e API)
export const SPELLCASTING_CLASSES = new Set([
  'bard', 'cleric', 'druid', 'paladin', 'ranger',
  'sorcerer', 'warlock', 'wizard',
]);

export function isSpellcastingClass(classIndex: string): boolean {
  return SPELLCASTING_CLASSES.has(classIndex.toLowerCase());
}
