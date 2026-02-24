import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Campaign {
  id: number;
  name: string;
  theme: string;
  difficulty: string;
  owner_id: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<{ campaigns: Campaign[] }>('/api/campaigns');
  }

  getById(id: number) {
    return this.http.get<{ campaign: Campaign }>(`/api/campaigns/${id}`);
  }

  create(data: { name: string; theme: string; difficulty: string }) {
    return this.http.post<{ campaign: Campaign }>('/api/campaigns', data);
  }
}

