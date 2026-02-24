import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CampaignService, Campaign } from '../../../services/campaign.service';
import { MessageService, Message } from '../../../services/message.service';
import { AuthService } from '../../../services/auth.service';

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
  messageContent = '';

  private campaignId = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private campaignService: CampaignService,
    private messageService: MessageService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.campaignId = Number(this.route.snapshot.paramMap.get('id'));
    this.campaignService.getById(this.campaignId).subscribe({
      next: (res) => {
        this.campaign.set(res.campaign);
        this.loading.set(false);
        this.loadMessages(true);
        this.pollInterval = setInterval(() => this.loadMessages(false), 3000);
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
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  isCurrentUser(userId: number): boolean {
    return this.authService.currentUser()?.id === userId;
  }

  sendMessage(): void {
    const content = this.messageContent.trim();
    if (!content || this.sending()) return;

    this.sending.set(true);
    this.messageService.send(this.campaignId, content).subscribe({
      next: (res) => {
        this.messages.update((msgs) => [...msgs, res.message]);
        this.messageContent = '';
        this.sending.set(false);
        this.shouldScrollToBottom = true;
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

  private loadMessages(forceScroll: boolean): void {
    const el = this.messageList?.nativeElement;
    const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 50;

    this.messageService.list(this.campaignId).subscribe({
      next: (res) => {
        this.messages.set(res.messages);
        if (forceScroll || atBottom) {
          this.shouldScrollToBottom = true;
        }
      },
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.messageList.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }
}

