import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-magic',
  imports: [CommonModule, RouterLink],
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
