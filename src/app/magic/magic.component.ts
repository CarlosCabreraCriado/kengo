import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, Tokens } from '../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

// Formulario Angular:
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// UI Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HttpClient } from '@angular/common/http';
import { environment as env } from '../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-magic',
  imports: [
    MatButtonModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './magic.component.html',
  styleUrl: './magic.component.css',
})
export class MagicComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  public loading = signal(true);

  error = signal<string | null>(null);

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Token no proporcionado');
      return;
    }

    try {
      await this.authService.logout(true); // limpiar estado previo
    } catch (err) {
      console.error('Error during logout:', err);
    }

    console.warn('Consumir magic link con token:', token);
    this.http
      .post<{
        tokens: Tokens;
        pass: string;
        email: string;
      }>(`${env.API_URL}/consumirMagicLink`, { token })
      .subscribe({
        next: async (data: { tokens: Tokens; pass: string; email: string }) => {
          console.log('Respuesta consumirMagicLink:', data);
          if (data.tokens.access_token) {
            console.warn('Login exitoso con magic link, tokens:', data.tokens);
            await this.authService.loginMagicLink(
              data.tokens,
              data.email,
              data.pass,
            );
            this.router.navigateByUrl('/');
          } else {
            this.router.navigateByUrl('/login');
          }
        },
        error: (err) => {
          console.error('Error al consumir el magic link', err);
          this.error.set('Enlace inválido o expirado');
        },
      });
  }
}
