import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CampaignService, Campaign } from '../../../services/campaign.service';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.css',
})
export class CampaignDetailComponent implements OnInit {
  campaign = signal<Campaign | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private campaignService: CampaignService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.campaignService.getById(id).subscribe({
      next: (res) => {
        this.campaign.set(res.campaign);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Campaign not found or you do not have access.');
        this.loading.set(false);
      },
    });
  }
}

