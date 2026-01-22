import { Component, inject, signal, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

// UI Angular Material:
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  standalone: true,
  selector: 'app-magic',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './magic.component.html',
  styleUrl: './magic.component.css',
})
export class MagicComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.error.set('Token no proporcionado');
      this.loading.set(false);
      return;
    }

    try {
      // Limpiar sesión previa si existe
      await this.authService.logout(true);

      // Consumir magic link (el BFF establece la cookie)
      await this.authService.consumeMagic(token);

      // Redirigir a inicio
      this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set('Enlace inválido o expirado');
      this.loading.set(false);
    }
  }
}
