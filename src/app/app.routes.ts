// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => 
      import('./components/login/login').then(m => m.LoginComponent),
    canActivate: [noAuthGuard],
    title: 'Login'
  },
  {
    path: 'dashboard',
    loadComponent: () => 
      import('./components/dashboard/dashboard').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'Dashboard'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
