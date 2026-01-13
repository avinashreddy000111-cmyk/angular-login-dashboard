// src/app/services/auth.ts

import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { UserCredentials, LoginResponse } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Hardcoded valid credentials
  private readonly VALID_USERNAME = 'avinash';
  private readonly VALID_PASSWORD = 'avinash@1234';
  
  // Authentication state using signals
  private isAuthenticatedSignal = signal<boolean>(this.checkStoredAuth());
  private currentUserSignal = signal<string | null>(this.getStoredUser());
  
  // Public computed signals
  readonly isAuthenticated = computed(() => this.isAuthenticatedSignal());
  readonly currentUser = computed(() => this.currentUserSignal());

  constructor(private router: Router) {}

  /**
   * Authenticates user with provided credentials
   */
  login(credentials: UserCredentials): LoginResponse {
    const { username, password } = credentials;

    // Validate username
    if (username !== this.VALID_USERNAME) {
      return {
        success: false,
        message: 'Invalid user'
      };
    }

    // Validate password
    if (password !== this.VALID_PASSWORD) {
      return {
        success: false,
        message: 'Invalid password'
      };
    }

    // Successful authentication
    const token = this.generateToken();
    this.setAuthState(username, token);

    return {
      success: true,
      message: 'Login successful',
      token
    };
  }

  /**
   * Logs out the current user
   */
  logout(): void {
    this.clearAuthState();
    this.router.navigate(['/login']);
  }

  /**
   * Checks if user is currently authenticated
   */
  checkAuthentication(): boolean {
    return this.isAuthenticatedSignal();
  }

  /**
   * Gets the current user's username
   */
  getUsername(): string | null {
    return this.currentUserSignal();
  }

  private generateToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private setAuthState(username: string, token: string): void {
    this.isAuthenticatedSignal.set(true);
    this.currentUserSignal.set(username);
    
    try {
      sessionStorage.setItem('auth_token', token);
      sessionStorage.setItem('auth_user', username);
    } catch (error) {
      console.error('Failed to store auth state:', error);
    }
  }

  private clearAuthState(): void {
    this.isAuthenticatedSignal.set(false);
    this.currentUserSignal.set(null);
    
    try {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }
  }

  private checkStoredAuth(): boolean {
    try {
      const token = sessionStorage.getItem('auth_token');
      return !!token;
    } catch {
      return false;
    }
  }

  private getStoredUser(): string | null {
    try {
      return sessionStorage.getItem('auth_user');
    } catch {
      return null;
    }
  }
}
