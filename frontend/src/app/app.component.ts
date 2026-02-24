import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface HealthResponse {
  status: string;
  db: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  health = signal<HealthResponse | null>(null);
  error = signal<string | null>(null);
  loading = signal(true);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<HealthResponse>('/api/health').subscribe({
      next: (data) => {
        this.health.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to reach backend');
        this.loading.set(false);
      },
    });
  }
}

