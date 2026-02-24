import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CampaignService, Campaign } from '../../../services/campaign.service';
import { MessageService, Message } from '../../../services/message.service';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.css',
})
export class CampaignDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageList') private messageList!: ElementRef<HTMLDivElement>;

  campaign = signal<Campaign | null>(null);
  messages = signal<Message[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  sending = signal(false);
  codeCopied = signal(false);
  messageContent = '';

  private campaignId = 0;
  private socketSub: Subscription | null = null;
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private campaignService: CampaignService,
    private messageService: MessageService,
    private authService: AuthService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.campaignId = Number(this.route.snapshot.paramMap.get('id'));
    this.campaignService.getById(this.campaignId).subscribe({
      next: (res) => {
        this.campaign.set(res.campaign);
        this.loading.set(false);
        // Load history once, then switch to socket for live updates
        this.messageService.list(this.campaignId).subscribe({
          next: (r) => {
            this.messages.set(r.messages);
            this.shouldScrollToBottom = true;
          },
        });
        this.socketService.connect();
        this.socketService.joinCampaign(this.campaignId);
        this.socketSub = this.socketService.onNewMessage().subscribe((msg) => {
          this.messages.update((msgs) => [...msgs, msg]);
          this.shouldScrollToBottom = true;
        });
      },
      error: () => {
        this.error.set('Campaign not found or you do not have access.');
        this.loading.set(false);
      },
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.socketSub?.unsubscribe();
    this.socketService.leaveCampaign();
  }

  isCurrentUser(userId: number): boolean {
    return this.authService.currentUser()?.id === userId;
  }

  copyInviteCode(): void {
    const code = this.campaign()?.invite_code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    });
  }

  sendMessage(): void {
    const content = this.messageContent.trim();
    if (!content || this.sending()) return;

    this.sending.set(true);
    this.messageService.send(this.campaignId, content).subscribe({
      next: () => {
        // Do NOT add message locally — socket event delivers it to everyone including sender
        this.messageContent = '';
        this.sending.set(false);
      },
      error: () => {
        this.sending.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messageList.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }
}

