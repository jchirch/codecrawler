import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  user = signal<User | null>(null);
  error = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    // currentUser already populated by AuthService on startup; refresh anyway
    this.auth.fetchMe().subscribe({
      next: () => this.user.set(this.auth.currentUser()),
      error: (err) => this.error.set(err.error?.error ?? 'Failed to load user'),
    });
  }

  logout(): void {
    this.auth.logout();
  }
}

