import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CharacterService, Character, InventoryItem, SpellRef } from '../../services/character.service';

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './character-sheet.component.html',
  styleUrl: './character-sheet.component.css',
})
export class CharacterSheetComponent implements OnInit {
  campaignId = 0;
  characterId = 0;

  character = signal<Character | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  saving = signal(false);
  saveSuccess = signal(false);

  // Edit mode
  editingStats = signal(false);
  editForm: Partial<Character> = {};

  // XP award
  xpAmount = signal(0);
  awardingXp = signal(false);
  xpMessage = signal<string | null>(null);

  // New inventory item
  showAddItem = signal(false);
  newItem = { name: '', description: '', quantity: 1 };
  addingItem = signal(false);

  // Computed XP progress
  xpProgress = computed(() => {
    const char = this.character();
    if (!char) return 0;
    const thresholds = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
    if (char.level >= 20) return 100;
    const currentLevelXp = thresholds[char.level - 1];
    const nextLevelXp = thresholds[char.level];
    const progress = (char.experience_points - currentLevelXp) / (nextLevelXp - currentLevelXp);
    return Math.min(100, Math.max(0, Math.round(progress * 100)));
  });

  xpForNextLevel = computed(() => {
    const char = this.character();
    if (!char || char.level >= 20) return null;
    const thresholds = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
    return thresholds[char.level];
  });

  constructor(
    private route: ActivatedRoute,
    private characterService: CharacterService,
  ) {}

  ngOnInit(): void {
    this.campaignId = Number(this.route.snapshot.paramMap.get('campaignId'));
    this.characterId = Number(this.route.snapshot.paramMap.get('characterId'));
    this.loadCharacter();
  }

  loadCharacter(): void {
    this.characterService.getCharacter(this.characterId).subscribe({
      next: (res) => {
        this.character.set(res.character);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Character not found.');
        this.loading.set(false);
      }
    });
  }

  abilityModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  proficiencyBonus(): string {
    const char = this.character();
    if (!char) return '+2';
    const bonus = Math.ceil(char.level / 4) + 1;
    return `+${bonus}`;
  }

  hpPercent(): number {
    const char = this.character();
    if (!char || char.max_hp === 0) return 0;
    return Math.round((char.current_hp / char.max_hp) * 100);
  }

  startEditStats(): void {
    const char = this.character();
    if (!char) return;
    this.editForm = {
      strength: char.strength,
      dexterity: char.dexterity,
      constitution: char.constitution,
      intelligence: char.intelligence,
      wisdom: char.wisdom,
      charisma: char.charisma,
      max_hp: char.max_hp,
      current_hp: char.current_hp,
      armor_class: char.armor_class,
    };
    this.editingStats.set(true);
  }

  saveStats(): void {
    if (!this.editForm || this.saving()) return;
    this.saving.set(true);
    this.characterService.updateCharacter(this.characterId, this.editForm).subscribe({
      next: (res) => {
        this.character.set(res.character);
        this.editingStats.set(false);
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 2500);
      },
      error: () => { this.saving.set(false); }
    });
  }

  cancelEdit(): void {
    this.editingStats.set(false);
    this.editForm = {};
  }

  awardXp(): void {
    const amount = this.xpAmount();
    if (amount <= 0 || this.awardingXp()) return;
    this.awardingXp.set(true);
    this.xpMessage.set(null);
    this.characterService.awardXp(this.characterId, amount).subscribe({
      next: (res) => {
        this.character.set(res.character);
        this.xpAmount.set(0);
        this.awardingXp.set(false);
        if (res.leveledUp) {
          this.xpMessage.set(`🎉 Level Up! You are now level ${res.character.level}!`);
        } else {
          const next = this.xpForNextLevel();
          this.xpMessage.set(`+${amount} XP gained! ${next !== null ? (next - res.character.experience_points) + ' XP until next level.' : 'Max level reached!'}`);
        }
        setTimeout(() => this.xpMessage.set(null), 5000);
      },
      error: () => { this.awardingXp.set(false); }
    });
  }

  addItem(): void {
    if (!this.newItem.name.trim() || this.addingItem()) return;
    this.addingItem.set(true);
    this.characterService.addInventoryItem(this.characterId, {
      name: this.newItem.name.trim(),
      description: this.newItem.description,
      quantity: this.newItem.quantity,
    }).subscribe({
      next: (res) => {
        const char = this.character();
        if (char) {
          this.character.set({ ...char, inventory: [...char.inventory, res.item] });
        }
        this.newItem = { name: '', description: '', quantity: 1 };
        this.showAddItem.set(false);
        this.addingItem.set(false);
      },
      error: () => { this.addingItem.set(false); }
    });
  }

  removeItem(itemId: number): void {
    this.characterService.deleteInventoryItem(this.characterId, itemId).subscribe({
      next: () => {
        const char = this.character();
        if (char) {
          this.character.set({ ...char, inventory: char.inventory.filter(i => i.id !== itemId) });
        }
      },
      error: () => {}
    });
  }

  updateItemQuantity(item: InventoryItem, qty: number): void {
    if (qty < 1) return;
    this.characterService.updateInventoryItem(this.characterId, item.id, { quantity: qty }).subscribe({
      next: (res) => {
        const char = this.character();
        if (char) {
          this.character.set({ ...char, inventory: char.inventory.map(i => i.id === item.id ? res.item : i) });
        }
      },
      error: () => {}
    });
  }

  // Helper to read ability score from character (avoids 'keyof' in template)
  getCharStat(key: string): number {
    const char = this.character();
    if (!char) return 10;
    return (char as unknown as Record<string, number>)[key] ?? 10;
  }

  // Helper to read/write ability scores in editForm
  getEditStat(key: string): number {
    return (this.editForm as Record<string, number>)[key] ?? 10;
  }

  setEditStat(key: string, value: number): void {
    (this.editForm as Record<string, number>)[key] = value;
  }

  get spellsByLevel(): { level: number; spells: SpellRef[] }[] {
    const char = this.character();
    if (!char || !char.spells || char.spells.length === 0) return [];
    const grouped = new Map<number, SpellRef[]>();
    for (const spell of char.spells) {
      const arr = grouped.get(spell.level) ?? [];
      arr.push(spell);
      grouped.set(spell.level, arr);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([level, spells]) => ({ level, spells }));
  }

  levelLabel(level: number): string {
    return level === 0 ? 'Cantrips' : `Level ${level}`;
  }
}
