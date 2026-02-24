import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Message {
  id: number;
  campaign_id: number;
  user_id: number;
  content: string;
  created_at: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  constructor(private http: HttpClient) {}

  list(campaignId: number) {
    return this.http.get<{ messages: Message[] }>(`/api/campaigns/${campaignId}/messages`);
  }

  send(campaignId: number, content: string) {
    return this.http.post<{ message: Message }>(`/api/campaigns/${campaignId}/messages`, { content });
  }
}

