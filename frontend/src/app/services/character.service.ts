import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Character {
  id: number;
  user_id: number;
  campaign_id: number;
  name: string;
  race: string;
  class: string;
  level: number;
  experience_points: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  max_hp: number;
  current_hp: number;
  armor_class: number;
  hit_die: string | null;
  spells: SpellRef[];
  inventory: InventoryItem[];
  created_at: string;
}

export interface InventoryItem {
  id: number;
  character_id: number;
  name: string;
  description: string;
  quantity: number;
  created_at: string;
}

export interface SpellRef {
  index: string;
  name: string;
  level: number;
}

export interface Dnd5eClass {
  index: string;
  name: string;
  hit_die?: number;
  spellcasting?: { level: number; spellcasting_ability: { name: string } };
}

export interface Dnd5eRace {
  index: string;
  name: string;
}

export interface SpellOption {
  index: string;
  name: string;
  level: number;
}

export interface CreateCharacterDto {
  name: string;
  race: string;
  class: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  max_hp?: number;
  armor_class?: number;
  hit_die?: number;
  spells?: SpellRef[];
}

@Injectable({ providedIn: 'root' })
export class CharacterService {
  constructor(private http: HttpClient) {}

  getMyCharacter(campaignId: number): Observable<{ character: Character }> {
    return this.http.get<{ character: Character }>(`/api/campaigns/${campaignId}/my-character`);
  }

  createCharacter(campaignId: number, data: CreateCharacterDto): Observable<{ character: Character }> {
    return this.http.post<{ character: Character }>(`/api/campaigns/${campaignId}/characters`, data);
  }

  getCharacter(id: number): Observable<{ character: Character }> {
    return this.http.get<{ character: Character }>(`/api/characters/${id}`);
  }

  updateCharacter(id: number, data: Partial<Character> & { spells?: SpellRef[] }): Observable<{ character: Character }> {
    return this.http.patch<{ character: Character }>(`/api/characters/${id}`, data);
  }

  awardXp(id: number, amount: number): Observable<{ character: Character; leveledUp: boolean; xpForNext: number | null }> {
    return this.http.post<{ character: Character; leveledUp: boolean; xpForNext: number | null }>(`/api/characters/${id}/xp`, { amount });
  }

  addInventoryItem(id: number, item: { name: string; description: string; quantity: number }): Observable<{ item: InventoryItem }> {
    return this.http.post<{ item: InventoryItem }>(`/api/characters/${id}/inventory`, item);
  }

  updateInventoryItem(charId: number, itemId: number, data: Partial<InventoryItem>): Observable<{ item: InventoryItem }> {
    return this.http.patch<{ item: InventoryItem }>(`/api/characters/${charId}/inventory/${itemId}`, data);
  }

  deleteInventoryItem(charId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`/api/characters/${charId}/inventory/${itemId}`);
  }

  // DnD 5e API wrappers
  getClasses(): Observable<{ results: Dnd5eClass[] }> {
    return this.http.get<{ results: Dnd5eClass[] }>('/api/dnd5e/classes');
  }

  getClassDetail(index: string): Observable<Dnd5eClass> {
    return this.http.get<Dnd5eClass>(`/api/dnd5e/classes/${index}`);
  }

  getRaces(): Observable<{ results: Dnd5eRace[] }> {
    return this.http.get<{ results: Dnd5eRace[] }>('/api/dnd5e/races');
  }

  getSpells(classIndex: string, level?: number): Observable<{ results: SpellOption[] }> {
    const url = level !== undefined
      ? `/api/dnd5e/spells?class=${classIndex}&level=${level}`
      : `/api/dnd5e/spells?class=${classIndex}`;
    return this.http.get<{ results: SpellOption[] }>(url);
  }
}
