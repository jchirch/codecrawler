import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CharacterService, Dnd5eClass, Dnd5eRace, SpellOption, SpellRef, CreateCharacterDto } from '../../../services/character.service';

const SPELLCASTING_CLASSES = new Set(['bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard']);

@Component({
  selector: 'app-new-character',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './new-character.component.html',
  styleUrl: './new-character.component.css',
})
export class NewCharacterComponent implements OnInit {
  campaignId = 0;

  // Loading state
  loadingClasses = signal(true);
  loadingRaces = signal(true);
  loadingSpells = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);

  // DnD API data
  classes = signal<Dnd5eClass[]>([]);
  races = signal<Dnd5eRace[]>([]);
  spells = signal<SpellOption[]>([]);

  // Selected class detail
  selectedClassDetail = signal<Dnd5eClass | null>(null);
  isSpellcaster = signal(false);

  // Form model
  form = {
    name: '',
    race: '',
    class: '',
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    max_hp: 8,
    armor_class: 10,
    selectedSpells: [] as string[],
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private characterService: CharacterService,
  ) {}

  ngOnInit(): void {
    this.campaignId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadClasses();
    this.loadRaces();
  }

  loadClasses(): void {
    this.characterService.getClasses().subscribe({
      next: (res) => {
        this.classes.set(res.results);
        this.loadingClasses.set(false);
      },
      error: () => { this.loadingClasses.set(false); this.error.set('Failed to load classes'); }
    });
  }

  loadRaces(): void {
    this.characterService.getRaces().subscribe({
      next: (res) => {
        this.races.set(res.results);
        this.loadingRaces.set(false);
      },
      error: () => { this.loadingRaces.set(false); this.error.set('Failed to load races'); }
    });
  }

  onClassChange(): void {
    if (!this.form.class) {
      this.selectedClassDetail.set(null);
      this.isSpellcaster.set(false);
      this.spells.set([]);
      return;
    }

    this.characterService.getClassDetail(this.form.class).subscribe({
      next: (detail) => {
        this.selectedClassDetail.set(detail);
        const spellcaster = SPELLCASTING_CLASSES.has(this.form.class.toLowerCase());
        this.isSpellcaster.set(spellcaster);

        // Auto-calculate starting HP from hit die + CON modifier
        const conMod = Math.floor((this.form.constitution - 10) / 2);
        this.form.max_hp = (detail.hit_die || 8) + conMod;

        // Load spells if spellcaster
        if (spellcaster) {
          this.loadingSpells.set(true);
          this.form.selectedSpells = [];
          // Load cantrips + level 1 spells
          this.characterService.getSpells(this.form.class).subscribe({
            next: (res) => {
              // Show only cantrips (0) and level 1 spells for new characters
              const filtered = res.results.filter(s => s.level <= 1);
              this.spells.set(filtered);
              this.loadingSpells.set(false);
            },
            error: () => { this.loadingSpells.set(false); }
          });
        } else {
          this.spells.set([]);
          this.form.selectedSpells = [];
        }
      },
      error: () => {}
    });
  }

  onStatChange(): void {
    // Recalculate HP when CON changes
    const detail = this.selectedClassDetail();
    if (detail) {
      const conMod = Math.floor((this.form.constitution - 10) / 2);
      this.form.max_hp = (detail.hit_die || 8) + conMod;
    }
  }

  toggleSpell(spellIndex: string): void {
    const idx = this.form.selectedSpells.indexOf(spellIndex);
    if (idx === -1) {
      this.form.selectedSpells.push(spellIndex);
    } else {
      this.form.selectedSpells.splice(idx, 1);
    }
  }

  isSpellSelected(spellIndex: string): boolean {
    return this.form.selectedSpells.includes(spellIndex);
  }

  getFormStat(key: string): number {
    return (this.form as unknown as Record<string, number>)[key] ?? 10;
  }

  setFormStat(key: string, val: number): void {
    (this.form as unknown as Record<string, number>)[key] = val;
  }

  abilityModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  get canSubmit(): boolean {
    return !this.submitting() && !!this.form.name.trim() && !!this.form.race && !!this.form.class;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting.set(true);
    this.error.set(null);

    const detail = this.selectedClassDetail();
    const selectedSpellRefs = this.form.selectedSpells.map(idx => {
      const spell = this.spells().find(s => s.index === idx);
      return spell ? { index: spell.index, name: spell.name, level: spell.level } : null;
    }).filter(Boolean);

    this.characterService.createCharacter(this.campaignId, {
      name: this.form.name.trim(),
      race: this.form.race,
      class: this.form.class,
      strength: this.form.strength,
      dexterity: this.form.dexterity,
      constitution: this.form.constitution,
      intelligence: this.form.intelligence,
      wisdom: this.form.wisdom,
      charisma: this.form.charisma,
      max_hp: this.form.max_hp,
      armor_class: this.form.armor_class,
      hit_die: detail?.hit_die,
      spells: selectedSpellRefs as SpellRef[],
    }).subscribe({
      next: (res) => {
        this.router.navigate(['/campaigns', this.campaignId, 'character', res.character.id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.error || 'Failed to create character');
      }
    });
  }
}
