import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { Message } from './message.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private currentCampaignId: number | null = null;

  constructor(private authService: AuthService, private zone: NgZone) {}

  connect(): void {
    if (this.socket?.connected) return;
    this.socket = io({
      auth: { token: this.authService.getToken() },
    });
    this.socket.on('connect', () => {
      // Re-join room on reconnect
      if (this.currentCampaignId !== null) {
        this.socket?.emit('join-campaign', this.currentCampaignId);
      }
    });
  }

  joinCampaign(campaignId: number): void {
    this.currentCampaignId = campaignId;
    this.socket?.emit('join-campaign', campaignId);
  }

  leaveCampaign(): void {
    if (this.currentCampaignId !== null) {
      this.socket?.emit('leave-campaign', this.currentCampaignId);
      this.currentCampaignId = null;
    }
  }

  onNewMessage(): Observable<Message> {
    return new Observable<Message>((observer) => {
      const handler = (msg: Message) => {
        this.zone.run(() => observer.next(msg));
      };
      this.socket?.on('new-message', handler);
      return () => {
        this.socket?.off('new-message', handler);
      };
    });
  }

  onLevelUp(): Observable<{ characterId: number; newLevel: number }> {
    return new Observable((observer) => {
      const handler = (data: { characterId: number; newLevel: number }) => {
        this.zone.run(() => observer.next(data));
      };
      this.socket?.on('level-up', handler);
      return () => {
        this.socket?.off('level-up', handler);
      };
    });
  }

  onItemGranted(): Observable<{ userId: number; characterId: number; item: { name: string; description: string } }> {
    return new Observable((observer) => {
      const handler = (data: { userId: number; characterId: number; item: { name: string; description: string } }) => {
        this.zone.run(() => observer.next(data));
      };
      this.socket?.on('item-granted', handler);
      return () => {
        this.socket?.off('item-granted', handler);
      };
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

