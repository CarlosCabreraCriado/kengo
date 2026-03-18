import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment as env } from '../../../../../environments/environment';
import { KENGO_BREAKPOINTS } from '../../../../shared';

interface RegistroExpandido {
  id_registro: number;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
  plan_item: {
    id: number;
    sort: number;
    series?: number;
    repeticiones?: number;
    duracion_seg?: number;
    instrucciones_paciente?: string;
    ejercicio: {
      id_ejercicio: number;
      nombre_ejercicio: string;
      portada: string | null;
    };
    plan: {
      id_plan: number;
      titulo: string;
    };
  };
}

interface GrupoPlan {
  planId: number;
  planTitulo: string;
  registros: RegistroExpandido[];
}

@Component({
  selector: 'app-sesion-detail',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './sesion-detail.component.html',
  styleUrl: './sesion-detail.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class SesionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private breakpointObserver = inject(BreakpointObserver);

  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  // State
  readonly grupos = signal<GrupoPlan[]>([]);
  readonly fecha = signal<string>('');
  readonly pacienteId = signal<string>('');
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  // Computed
  readonly totalEjercicios = computed(() =>
    this.grupos().reduce((sum, g) => sum + g.registros.length, 0),
  );

  readonly promedioDolor = computed(() => {
    const todos = this.grupos().flatMap((g) => g.registros);
    const dolores = todos
      .filter((r) => r.dolor_escala != null)
      .map((r) => r.dolor_escala!);
    if (dolores.length === 0) return null;
    return Math.round((dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10) / 10;
  });

  readonly totalComentarios = computed(() => {
    const todos = this.grupos().flatMap((g) => g.registros);
    return todos.filter((r) => r.nota_paciente?.trim()).length;
  });

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    const fecha = this.route.snapshot.params['fecha'];

    if (!id || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.router.navigate(['/mis-pacientes']);
      return;
    }

    this.pacienteId.set(id);
    this.fecha.set(fecha);
    this.cargarRegistros();
  }

  private async cargarRegistros() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const fechaInicio = `${this.fecha()}T00:00:00`;
      const siguiente = new Date(this.fecha());
      siguiente.setDate(siguiente.getDate() + 1);
      const fechaFin = `${siguiente.toISOString().split('T')[0]}T00:00:00`;

      const response = await firstValueFrom(
        this.http.get<{ data: RegistroExpandido[] }>(
          `${env.DIRECTUS_URL}/items/planes_registros`,
          {
            params: {
              fields: [
                'id_registro',
                'fecha_hora',
                'completado',
                'repeticiones_realizadas',
                'duracion_real_seg',
                'dolor_escala',
                'esfuerzo_escala',
                'nota_paciente',
                'plan_item.id',
                'plan_item.sort',
                'plan_item.series',
                'plan_item.repeticiones',
                'plan_item.duracion_seg',
                'plan_item.instrucciones_paciente',
                'plan_item.ejercicio.id_ejercicio',
                'plan_item.ejercicio.nombre_ejercicio',
                'plan_item.ejercicio.portada',
                'plan_item.plan.id_plan',
                'plan_item.plan.titulo',
              ].join(','),
              filter: JSON.stringify({
                _and: [
                  { paciente: { _eq: this.pacienteId() } },
                  { completado: { _eq: true } },
                  { fecha_hora: { _gte: fechaInicio } },
                  { fecha_hora: { _lt: fechaFin } },
                ],
              }),
              sort: 'plan_item.plan.id_plan,plan_item.sort',
            },
            withCredentials: true,
          },
        ),
      );

      const registros = response?.data || [];
      this.grupos.set(this.agruparPorPlan(registros));
    } catch (err) {
      console.error('Error cargando registros de sesión:', err);
      this.error.set('Error al cargar los detalles de la sesión');
    } finally {
      this.isLoading.set(false);
    }
  }

  private agruparPorPlan(registros: RegistroExpandido[]): GrupoPlan[] {
    const mapa = new Map<number, GrupoPlan>();

    for (const reg of registros) {
      const planId = reg.plan_item.plan.id_plan;
      if (!mapa.has(planId)) {
        mapa.set(planId, {
          planId,
          planTitulo: reg.plan_item.plan.titulo,
          registros: [],
        });
      }
      mapa.get(planId)!.registros.push(reg);
    }

    return Array.from(mapa.values());
  }

  // === Helpers ===

  formatearFechaLarga(fecha: string): string {
    const d = new Date(fecha + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  getDolorColor(dolor: number | null): string {
    if (dolor === null) return 'text-zinc-400';
    if (dolor <= 3) return 'dolor-low';
    if (dolor <= 6) return 'dolor-mid';
    return 'dolor-high';
  }

  getDolorBgClass(dolor: number | null): string {
    if (dolor === null) return 'dolor-badge-neutral';
    if (dolor <= 3) return 'dolor-badge-low';
    if (dolor <= 6) return 'dolor-badge-mid';
    return 'dolor-badge-high';
  }

  assetUrl(portada: string | null): string | null {
    if (!portada) return null;
    return `${env.DIRECTUS_URL}/assets/${portada}?fit=cover&width=160&height=160&quality=80`;
  }

  formatDuracion(seg: number): string {
    if (seg < 60) return `${seg}s`;
    const min = Math.floor(seg / 60);
    const rest = seg % 60;
    return rest > 0 ? `${min}m ${rest}s` : `${min}m`;
  }

  // === Navigation ===

  volver() {
    this.router.navigate(['/mis-pacientes', this.pacienteId()]);
  }

  verPlan(planId: number) {
    this.router.navigate(['/planes', planId]);
  }
}
