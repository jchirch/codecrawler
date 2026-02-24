import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  username = '';
  saving = signal(false);
  saved = signal(false);
  error = signal<string | null>(null);

  currentUsername = computed(() => this.authService.currentUser()?.username ?? '');
  currentEmail = computed(() => this.authService.currentUser()?.email ?? '');

  constructor(public authService: AuthService) {
    // Pre-fill with existing username if set
    const existing = this.authService.currentUser()?.username;
    if (existing) this.username = existing;
  }

  save(): void {
    if (this.saving()) return;
    this.error.set(null);
    this.saved.set(false);
    this.saving.set(true);

    this.authService.updateSettings(this.username).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Failed to save. Please try again.');
      },
    });
  }
}

