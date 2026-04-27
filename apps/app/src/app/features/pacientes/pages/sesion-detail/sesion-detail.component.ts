import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { KENGO_BREAKPOINTS } from '../../../../shared';
import { CumplimientoService } from '../../data-access/cumplimiento.service';
import type { DiaSemana } from '../../../../../types/global';
import { assetUrl } from '../../../../core/utils/asset-url';
import { ConvexService } from '../../../../core/convex/convex.service';
import { api } from '../../../../../../../../convex/_generated/api';

const DIAS_SEMANA: DiaSemana[] = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

interface RegistroExpandido {
  id_registro: string;
  fecha_hora: string;
  completado: boolean;
  repeticiones_realizadas?: number;
  duracion_real_seg?: number;
  dolor_escala?: number;
  esfuerzo_escala?: number;
  nota_paciente?: string;
  plan_item: {
    id: string;
    sort: number;
    series?: number;
    repeticiones?: number;
    duracion_seg?: number;
    instrucciones_paciente?: string;
    ejercicio: {
      id_ejercicio: string;
      nombre_ejercicio: string;
      portada: string | null;
    };
    plan: {
      id_plan: string;
      titulo: string;
    };
  };
}

interface GrupoPlan {
  planId: string;
  planTitulo: string;
  registros: RegistroExpandido[];
}

interface EjercicioAgendado {
  id: string;
  sort: number;
  nombre: string;
  portada: string | null;
  series: number | null;
  repeticiones: number | null;
  duracion_seg: number | null;
}

interface PlanAgendadoDetalle {
  plan_id: string;
  titulo: string;
  esperados: number;
  completados: number;
  ejercicios: EjercicioAgendado[];
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
  private breakpointObserver = inject(BreakpointObserver);
  private cumplimientoService = inject(CumplimientoService);
  private convex = inject(ConvexService);

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
  readonly planesAgendados = signal<PlanAgendadoDetalle[]>([]);
  readonly esFallido = signal(false);

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
    return (
      Math.round((dolores.reduce((a, b) => a + b, 0) / dolores.length) * 10) /
      10
    );
  });

  readonly totalComentarios = computed(() => {
    const todos = this.grupos().flatMap((g) => g.registros);
    return todos.filter((r) => r.nota_paciente?.trim()).length;
  });

  readonly totalEsperados = computed(() =>
    this.planesAgendados().reduce((sum, p) => sum + p.esperados, 0),
  );

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
      // Modelo nuevo: 1 documento por sesión clínica con sus ejecuciones
      // (`exerciseExecutions`) ya agrupadas y expandidas. Un día tiene 1 sesión
      // habitualmente (BN1), pero la query devuelve array por compatibilidad.
      const sesiones = (await this.convex.query(
        api.sessions.queries.getByPacienteAndDateWithExecutions,
        {
          pacienteId: this.pacienteId(),
          fecha: this.fecha(),
          soloCompletados: true,
        },
      )) ?? [];

      const validos: RegistroExpandido[] = [];
      for (const sesion of sesiones) {
        for (const e of sesion.executions ?? []) {
          if (!e.planExercise || !e.planExercise.exercise || !e.planExercise.plan) {
            continue;
          }
          validos.push({
            id_registro: e._id,
            fecha_hora: e.fechaHora,
            completado: e.completado,
            repeticiones_realizadas: e.repeticionesRealizadas,
            duracion_real_seg: e.duracionRealSeg,
            dolor_escala: e.dolorEscala,
            esfuerzo_escala: e.esfuerzoEscala,
            nota_paciente: e.notaPaciente,
            plan_item: {
              id: e.planExercise._id,
              sort: e.planExercise.sort,
              series: e.planExercise.series,
              repeticiones: e.planExercise.repeticiones,
              duracion_seg: e.planExercise.duracionSeg,
              instrucciones_paciente: e.planExercise.instruccionesPaciente,
              ejercicio: {
                id_ejercicio: e.planExercise.exercise._id,
                nombre_ejercicio: e.planExercise.exercise.nombreEjercicio,
                portada: e.planExercise.exercise.portada ?? null,
              },
              plan: {
                id_plan: e.planExercise.plan._id,
                titulo: e.planExercise.plan.titulo,
              },
            },
          });
        }
      }

      validos.sort((a, b) => {
        if (a.plan_item.plan.id_plan !== b.plan_item.plan.id_plan) {
          return a.plan_item.plan.id_plan.localeCompare(b.plan_item.plan.id_plan);
        }
        return a.plan_item.sort - b.plan_item.sort;
      });

      this.grupos.set(this.agruparPorPlan(validos));

      if (validos.length === 0) {
        await this.cargarPlanesAgendados();
      }
    } catch (err) {
      console.error('Error cargando registros de sesión:', err);
      this.error.set('Error al cargar los detalles de la sesión');
    } finally {
      this.isLoading.set(false);
    }
  }

  private agruparPorPlan(registros: RegistroExpandido[]): GrupoPlan[] {
    const mapa = new Map<string, GrupoPlan>();

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

  private async cargarPlanesAgendados() {
    try {
      const resp = await this.cumplimientoService.getCumplimiento(
        this.pacienteId(),
        this.fecha(),
        this.fecha(),
      );
      const dia = resp.dias.find((d) => d.fecha === this.fecha());
      if (!dia || dia.tipo !== 'fallido') return;

      const planesConEjercicios = dia.planes.filter((p) => p.esperados > 0);
      if (planesConEjercicios.length === 0) return;

      this.esFallido.set(true);

      const diaSemana =
        DIAS_SEMANA[new Date(this.fecha() + 'T12:00:00').getDay()];

      const ejerciciosPorPlan = await Promise.all(
        planesConEjercicios.map((p) =>
          this.convex.query(api.plans.queries.listExercisesByPlanId, {
            planId: p.plan_id as any,
          }),
        ),
      );

      this.planesAgendados.set(
        planesConEjercicios.map((p, i) => {
          const items = (ejerciciosPorPlan[i] ?? []).filter((item) => {
            const dias = item.diasSemana as DiaSemana[] | undefined;
            if (!dias || dias.length === 0) return true;
            return dias.includes(diaSemana);
          });
          return {
            ...p,
            ejercicios: items.map((item) => ({
              id: item._id,
              sort: item.sort,
              nombre: item.ejercicio?.nombreEjercicio ?? '',
              portada: item.ejercicio?.portada ?? null,
              series: item.series ?? null,
              repeticiones: item.repeticiones ?? null,
              duracion_seg: item.duracionSeg ?? null,
            })),
          };
        }),
      );
    } catch {
      // silently ignore — empty state will show
    }
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
    return `${assetUrl(portada, { fit: 'cover', width: 160, height: 160, quality: 80 })}`;
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

  verPlan(planId: string) {
    this.router.navigate(['/planes', planId]);
  }
}
