import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostBinding,
  inject,
  output,
} from '@angular/core';
import { SessionService } from '../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../core/auth/services/clinica-activa.service';
import { ClinicasService } from '../../../features/clinica/data-access/clinicas.service';
import { Clinica } from '../../../../types/global';

interface OpcionSwitchMenu {
  clinicId: string;
  nombre: string;
  puesto: string;
  activa: boolean;
}

/**
 * Selector de clínica activa pensado para vivir dentro del dropdown del
 * avatar (`ui2-user-menu`). Renderiza una lista plana (sin trigger ni
 * panel propio) que el menú contenedor decide mostrar u ocultar.
 *
 * Se oculta por completo cuando el usuario tiene 1 o 0 membresías
 * (no hay nada que elegir). Cuando hay ≥2, dispara `clinicaCambiada` con
 * la `Clinica` recién seleccionada para que el contenedor cierre el menú
 * y orqueste branding/toast/navegación.
 */
@Component({
  standalone: true,
  selector: 'ui2-clinica-switch-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; }
      .label {
        font: 600 11px/1 'Galvji', system-ui, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--ink-500, #6b6b6b);
        padding: 12px 14px 6px;
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0 6px 8px;
      }
      .option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 12px;
        background: transparent;
        border: 0;
        text-align: left;
        cursor: pointer;
        width: 100%;
        color: var(--ink-700, #333);
        transition: background 0.12s;
      }
      .option:hover { background: var(--cream-100, #f5efe6); }
      .option.active {
        background: var(--kengo-primary-alpha-10, rgba(231, 92, 62, 0.1));
      }
      .option.active .name { color: var(--kengo-primary, #e75c3e); }
      .check {
        font-family: 'Material Symbols Outlined';
        font-size: 18px;
        width: 18px;
        color: var(--kengo-primary, #e75c3e);
        flex-shrink: 0;
      }
      .check.placeholder { visibility: hidden; }
      .text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .name {
        font: 600 14px/1.2 'KengoDisplay', sans-serif;
        color: var(--ink-900, #111);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        font: 500 12px/1.2 'Galvji', sans-serif;
        color: var(--ink-500, #6b6b6b);
      }
    `,
  ],
  template: `
    @if (visible()) {
      <div class="label">Mi clínica activa</div>
      <div class="list" role="radiogroup" aria-label="Selecciona la clínica activa">
        @for (op of opciones(); track op.clinicId) {
          <button
            type="button"
            class="option"
            [class.active]="op.activa"
            role="radio"
            [attr.aria-checked]="op.activa"
            (click)="elegir(op.clinicId)"
          >
            <span class="check" [class.placeholder]="!op.activa" aria-hidden="true">
              check
            </span>
            <span class="text">
              <span class="name">{{ op.nombre }}</span>
              <span class="meta">{{ puestoLabel(op.puesto) }}</span>
            </span>
          </button>
        }
      </div>
    }
  `,
})
export class Ui2ClinicaSwitchMenuComponent {
  private session = inject(SessionService);
  private clinicaActiva = inject(ClinicaActivaService);
  private clinicasService = inject(ClinicasService);

  /** Emite la clínica recién seleccionada para que el contenedor cierre el
   *  menú y orqueste branding/toast/navegación. */
  readonly clinicaCambiada = output<Clinica>();

  protected readonly opciones = computed<OpcionSwitchMenu[]>(() => {
    const clinicas = this.clinicasService.misClinicas();
    const membresias = this.session.misclinicas();
    const activaId = this.clinicaActiva.selectedClinicaId();
    return clinicas.map((c) => ({
      clinicId: c.id,
      nombre: c.nombre,
      puesto: membresias.find((m) => m.clinicId === c.id)?.puesto ?? '',
      activa: c.id === activaId,
    }));
  });

  protected readonly visible = computed(() => this.opciones().length > 1);

  /** Oculta el host por completo cuando el usuario tiene una sola clínica.
   *  El menú contenedor sigue mostrando "Mi perfil" + "Cerrar sesión" sin
   *  hueco extra. */
  @HostBinding('style.display') get hostDisplay(): string {
    return this.visible() ? 'block' : 'none';
  }

  protected elegir(clinicId: string): void {
    if (clinicId === this.clinicaActiva.selectedClinicaId()) return;
    const clinica = this.clinicasService
      .misClinicas()
      .find((c) => c.id === clinicId);
    if (!clinica) return;
    this.clinicaActiva.set(clinicId);
    this.clinicaCambiada.emit(clinica);
  }

  protected puestoLabel(p: string): string {
    if (p === 'admin') return 'Administrador';
    if (p === 'fisio') return 'Fisioterapeuta';
    if (p === 'paciente') return 'Paciente';
    return '';
  }
}
