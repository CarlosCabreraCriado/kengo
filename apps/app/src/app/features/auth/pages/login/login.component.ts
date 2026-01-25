import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  public loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  get email() {
    return this.loginForm.controls.email;
  }
  get password() {
    return this.loginForm.controls.password;
  }

  async onSubmit() {
    if (this.loginForm.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.auth.login(email!, password!);
      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('No se pudo iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }
}
