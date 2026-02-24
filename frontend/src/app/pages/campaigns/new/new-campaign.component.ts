import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CampaignService } from '../../../services/campaign.service';

@Component({
  selector: 'app-new-campaign',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './new-campaign.component.html',
  styleUrl: './new-campaign.component.css',
})
export class NewCampaignComponent {
  readonly themes = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Horror', 'Steampunk', 'Cyberpunk'];
  readonly difficulties = ['Novice', 'Standard', 'Veteran', 'Legendary'];

  form = this.fb.group({
    name:       ['', [Validators.required, Validators.minLength(3)]],
    theme:      ['Fantasy', Validators.required],
    difficulty: ['Standard', Validators.required],
  });

  submitting = signal(false);
  error = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private campaignService: CampaignService,
    private router: Router,
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const { name, theme, difficulty } = this.form.value as { name: string; theme: string; difficulty: string };

    this.campaignService.create({ name, theme, difficulty }).subscribe({
      next: (res) => this.router.navigate(['/campaigns', res.campaign.id]),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to create campaign.');
        this.submitting.set(false);
      },
    });
  }
}

