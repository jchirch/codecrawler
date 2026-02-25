import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { CampaignService, Campaign } from '../../../services/campaign.service';
import { MessageService, Message } from '../../../services/message.service';
import { AuthService } from '../../../services/auth.service';
import { SocketService } from '../../../services/socket.service';
import { CharacterService, Character } from '../../../services/character.service';

interface DiceResult {
  rolls: number[];
  total: number;
  notation: string;
  formatted: string;
}

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

  // ── Character state ────────────────────────────────────────
  myCharacter = signal<Character | null>(null);
  levelUpToast = signal<string | null>(null);
  itemToast = signal<string | null>(null);

  // ── Dice roller state ──────────────────────────────────────────
  readonly DICE_TYPES = [4, 6, 8, 10, 12, 20];
  selectedDie = signal(20);
  diceCount = signal(1);
  diceModifier = signal(0);
  rolling = signal(false);
  diceResult = signal<DiceResult | null>(null);
  sendingDice = signal(false);

  campaignId = 0;
  private socketSub: Subscription | null = null;
  private levelUpSub: Subscription | null = null;
  private itemGrantedSub: Subscription | null = null;
  private shouldScrollToBottom = false;

  constructor(
    private route: ActivatedRoute,
    private campaignService: CampaignService,
    private messageService: MessageService,
    private authService: AuthService,
    private socketService: SocketService,
    private characterService: CharacterService,
    private http: HttpClient,
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
        // Listen for level-up events
        this.levelUpSub = this.socketService.onLevelUp().subscribe((data) => {
          const currentUser = this.authService.currentUser();
          const char = this.myCharacter();
          if (char && char.id === data.characterId) {
            this.myCharacter.set({ ...char, level: data.newLevel });
            this.levelUpToast.set(`🎉 Level Up! You are now level ${data.newLevel}!`);
            setTimeout(() => this.levelUpToast.set(null), 5000);
          }
        });
        // Listen for item-granted events
        this.itemGrantedSub = this.socketService.onItemGranted().subscribe((data) => {
          const currentUser = this.authService.currentUser();
          if (currentUser && data.userId === currentUser.id) {
            this.itemToast.set(`✨ You received: ${data.item.name}`);
            setTimeout(() => this.itemToast.set(null), 5000);
          }
        });
        // Load the user's character for this campaign
        this.characterService.getMyCharacter(this.campaignId).subscribe({
          next: (res) => this.myCharacter.set(res.character),
          error: () => { /* no character yet — that's fine */ },
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
    this.levelUpSub?.unsubscribe();
    this.itemGrantedSub?.unsubscribe();
    this.socketService.leaveCampaign();
  }

  isCurrentUser(userId: number | null): boolean {
    if (userId === null) return false;
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

  // ── Dice roller methods ────────────────────────────────────────
  selectDie(sides: number): void {
    this.selectedDie.set(sides);
    this.diceResult.set(null);
  }

  rollDice(): void {
    if (this.rolling()) return;
    this.rolling.set(true);
    this.diceResult.set(null);

    this.http.post<DiceResult>('/api/dice/roll', {
      count: this.diceCount(),
      sides: this.selectedDie(),
      modifier: this.diceModifier(),
    }).subscribe({
      next: (result) => {
        this.diceResult.set(result);
        this.rolling.set(false);
      },
      error: () => this.rolling.set(false),
    });
  }

  sendDiceToChat(): void {
    const result = this.diceResult();
    if (!result || this.sendingDice()) return;
    this.sendingDice.set(true);

    this.messageService.send(this.campaignId, result.formatted).subscribe({
      next: () => {
        this.sendingDice.set(false);
        this.diceResult.set(null);
      },
      error: () => this.sendingDice.set(false),
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.messageList.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }
}

