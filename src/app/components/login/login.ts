// src/app/components/login/login.ts

import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl
} from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm!: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  private returnUrl: string = '/dashboard';

  ngOnInit(): void {
    this.initializeForm();
    this.checkExistingAuth();
    this.getReturnUrl();
  }

  private initializeForm(): void {
    this.loginForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(100)
      ]]
    });

    this.loginForm.valueChanges.subscribe(() => {
      if (this.errorMessage()) {
        this.errorMessage.set(null);
      }
    });
  }

  private checkExistingAuth(): void {
    if (this.authService.checkAuthentication()) {
      this.router.navigate(['/dashboard']);
    }
  }

  private getReturnUrl(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
  }

  onSubmit(): void {
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      this.errorMessage.set('Please fill in all required fields correctly.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.value;

    setTimeout(() => {
      try {
        const result = this.authService.login({ username, password });

        if (result.success) {
          this.router.navigate([this.returnUrl]);
        } else {
          this.errorMessage.set(result.message);
        }
      } catch (error) {
        this.errorMessage.set('An unexpected error occurred. Please try again.');
        console.error('Login error:', error);
      } finally {
        this.isLoading.set(false);
      }
    }, 500);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  get usernameControl(): AbstractControl | null {
    return this.loginForm.get('username');
  }

  get passwordControl(): AbstractControl | null {
    return this.loginForm.get('password');
  }

  hasError(fieldName: string, errorType: string): boolean {
    const control = this.loginForm.get(fieldName);
    return control ? control.hasError(errorType) && control.touched : false;
  }

  getFieldError(fieldName: string): string | null {
    const control = this.loginForm.get(fieldName);
    
    if (!control || !control.errors || !control.touched) {
      return null;
    }

    if (control.hasError('required')) {
      return `${this.capitalizeFirst(fieldName)} is required.`;
    }
    
    if (control.hasError('minlength')) {
      const minLength = control.errors['minlength'].requiredLength;
      return `${this.capitalizeFirst(fieldName)} must be at least ${minLength} characters.`;
    }
    
    if (control.hasError('maxlength')) {
      const maxLength = control.errors['maxlength'].requiredLength;
      return `${this.capitalizeFirst(fieldName)} cannot exceed ${maxLength} characters.`;
    }

    return null;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
