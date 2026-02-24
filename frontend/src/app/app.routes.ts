import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'campaigns',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/campaigns/campaigns.component').then((m) => m.CampaignsComponent),
  },
  {
    path: 'campaigns/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/campaigns/new/new-campaign.component').then((m) => m.NewCampaignComponent),
  },
  {
    path: 'campaigns/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/campaigns/detail/campaign-detail.component').then((m) => m.CampaignDetailComponent),
  },
  { path: '**', redirectTo: '' },
];

