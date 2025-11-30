import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';

import { RutinasService } from '../services/rutinas.service';
import { PlanBuilderService } from '../services/plan-builder.service';
import { AppService } from '../services/app.service';
import { Rutina, RutinaCompleta, EjercicioRutina } from '../../types/global';
import { environment as env } from '../../environments/environment';

@Component({
  selector: 'app-rutinas',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatDividerModule,
    MatExpansionModule,
  ],
  templateUrl: './rutinas.component.html',
  styleUrl: './rutinas.component.css',
})
export class RutinasComponent implements OnInit {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  rutinasService = inject(RutinasService);
  private planBuilderService = inject(PlanBuilderService);
  private appService = inject(AppService);

  busqueda = '';
  filtroVisibilidad: 'todas' | 'privadas' | 'publicas' = 'todas';

  rutinas = computed(() => this.rutinasService.rutinas());
  isLoading = computed(() => this.rutinasService.isLoading());

  // Para preview de ejercicios
  expandedRutinaId = signal<number | null>(null);
  loadingPreview = signal(false);
  previewEjercicios = signal<EjercicioRutina[]>([]);

  // Usuario actual para verificar propiedad
  usuarioActual = computed(() => this.appService.usuario());

  ngOnInit() {
    this.rutinasService.reload();
  }

  onBusquedaChange(value: string) {
    this.rutinasService.setBusqueda(value);
  }

  onFiltroChange(value: 'todas' | 'privadas' | 'publicas') {
    this.rutinasService.setFiltroVisibilidad(value);
  }

  async togglePreview(rutina: Rutina) {
    if (this.expandedRutinaId() === rutina.id_rutina) {
      this.expandedRutinaId.set(null);
      this.previewEjercicios.set([]);
      return;
    }

    this.expandedRutinaId.set(rutina.id_rutina);
    this.loadingPreview.set(true);

    try {
      const completa = await this.rutinasService.getRutinaById(rutina.id_rutina);
      if (completa) {
        this.previewEjercicios.set(completa.ejercicios);
      }
    } finally {
      this.loadingPreview.set(false);
    }
  }

  isOwner(rutina: Rutina): boolean {
    const userId = this.usuarioActual()?.id;
    const autorId = typeof rutina.autor === 'string' ? rutina.autor : rutina.autor?.id;
    return userId === autorId;
  }

  usarPlantilla(rutina: Rutina) {
    // Ir a seleccionar paciente
    this.snackBar.open('Selecciona un paciente para usar esta plantilla', 'OK', {
      duration: 3000,
    });
    this.router.navigate(['/mis-pacientes']);
  }

  async duplicar(rutina: Rutina) {
    const nuevoNombre = `${rutina.nombre} (copia)`;
    const id = await this.rutinasService.duplicarRutina(rutina.id_rutina, nuevoNombre);

    if (id) {
      this.snackBar.open('Plantilla duplicada', 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Error al duplicar', 'OK', { duration: 3000 });
    }
  }

  async eliminar(rutina: Rutina) {
    if (!confirm(`¿Eliminar la plantilla "${rutina.nombre}"?`)) return;

    const success = await this.rutinasService.deleteRutina(rutina.id_rutina);
    if (success) {
      this.snackBar.open('Plantilla eliminada', 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Error al eliminar', 'OK', { duration: 3000 });
    }
  }

  async cambiarVisibilidad(rutina: Rutina) {
    const nuevaVisibilidad = rutina.visibilidad === 'privado' ? 'publico' : 'privado';
    const success = await this.rutinasService.updateRutina(rutina.id_rutina, {
      visibilidad: nuevaVisibilidad,
    });

    if (success) {
      this.snackBar.open(
        `Plantilla ahora es ${nuevaVisibilidad === 'publico' ? 'publica' : 'privada'}`,
        'OK',
        { duration: 2000 }
      );
    } else {
      this.snackBar.open('Error al cambiar visibilidad', 'OK', { duration: 3000 });
    }
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  assetUrl(id: string | null | undefined, w = 60, h = 60): string {
    if (!id) return '';
    return `${env.DIRECTUS_URL}/assets/${id}?width=${w}&height=${h}&fit=cover&format=webp`;
  }
}
