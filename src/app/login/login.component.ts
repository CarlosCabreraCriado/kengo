import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

// Formulario Angular:
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// UI Angular Material:
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    MatButtonModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  public loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  public error = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  login() {
    const { email, password } = this.loginForm.value;

    if (typeof email !== 'string' || typeof password !== 'string') {
      console.error('Email o password no validos');
      return;
    }

    this.authService.login(email, password).subscribe({
      next: () => {
        this.router.navigate(['/inicio/dashboard']);
      },
      error: () => {
        this.error = 'Credenciales incorrectas';
      },
    });
  }
}
