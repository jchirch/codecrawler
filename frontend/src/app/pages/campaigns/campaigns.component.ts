import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CampaignService, Campaign } from '../../services/campaign.service';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.css',
})
export class CampaignsComponent implements OnInit {
  campaigns = signal<Campaign[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private campaignService: CampaignService) {}

  ngOnInit(): void {
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

