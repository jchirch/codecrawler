import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CampaignService, Campaign } from '../../services/campaign.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.css',
})
export class CampaignsComponent implements OnInit {
  campaigns = signal<Campaign[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  joinCode = '';
  joining = signal(false);
  joinError = signal<string | null>(null);
  joinSuccess = signal<string | null>(null);

  constructor(
    private campaignService: CampaignService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadCampaigns();
  }

  isOwner(campaign: Campaign): boolean {
    return campaign.owner_id === this.authService.currentUser()?.id;
  }

  joinCampaign(): void {
    const code = this.joinCode.trim().toUpperCase();
    if (!code || this.joining()) return;

    this.joining.set(true);
    this.joinError.set(null);
    this.joinSuccess.set(null);

    this.campaignService.join(code).subscribe({
      next: (res) => {
        this.joinCode = '';
        this.joining.set(false);
        this.joinSuccess.set(`Joined "${res.campaign.name}"!`);
        this.loadCampaigns();
        setTimeout(() => this.joinSuccess.set(null), 3000);
      },
      error: (err) => {
        this.joining.set(false);
        this.joinError.set(err?.error?.error ?? 'Invalid invite code. Please try again.');
      },
    });
  }

  private loadCampaigns(): void {
    this.loading.set(true);
    this.campaignService.list().subscribe({
      next: (res) => {
        this.campaigns.set(res.campaigns);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load campaigns. Please try again.');
        this.loading.set(false);
      },
    });
  }
}

