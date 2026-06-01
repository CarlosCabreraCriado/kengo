import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { ClinicaActivaService } from '../../../../core/auth/services/clinica-activa.service';
import { ClinicasService } from '../../data-access/clinicas.service';
import {
  Ui2AvatarComponent,
  Ui2ButtonComponent,
  Ui2PillComponent,
  type Ui2PillVariant,
} from '../../../../shared/ui-v2';

interface OpcionClinica {
  clinicId: string;
  nombre: string;
  puesto: string;
  logo: string | null;
}

/**
 * Pantalla a la que se redirige al usuario con varias membresías cuando no
 * hay clínica activa válida. Al elegir una, se persiste y se redirige al
 * destino original (queryParam `next`) o a `/inicio`.
 */
@Component({
  standalone: true,
  selector: 'app-seleccionar-clinica',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2AvatarComponent, Ui2ButtonComponent, Ui2PillComponent],
  template: `
    <section class="screen">
      <div class="screen__inner">
        <header class="hero">
          <span class="hero__overline">MULTICLÍNICA</span>
          <h1 class="hero__title">¿Dónde trabajas hoy?</h1>
          <p class="hero__sub">
            Perteneces a varias clínicas. Elige cuál usar ahora — podrás
            cambiar en cualquier momento desde el menú.
          </p>
        </header>

        <ul class="options" role="list">
          @for (op of opciones(); track op.clinicId; let i = $index) {
            <li class="options__item" [style.--i]="i">
              <button
                type="button"
                class="option"
                (click)="elegir(op.clinicId)"
                [attr.aria-label]="'Entrar a ' + op.nombre"
              >
                <ui2-avatar
                  [name]="op.nombre"
                  [src]="op.logo"
                  size="md"
                  gradient="indigo"
                ></ui2-avatar>
                <div class="option__body">
                  <span class="option__name">{{ op.nombre }}</span>
                  <ui2-pill
                    [variant]="puestoVariant(op.puesto)"
                    size="sm"
                    [icon]="puestoIcon(op.puesto)"
                  >
                    {{ puestoLabel(op.puesto) }}
                  </ui2-pill>
                </div>
                <span
                  class="option__chevron material-symbols-outlined"
                  aria-hidden="true"
                  >arrow_forward</span
                >
              </button>
            </li>
          }
        </ul>

        <footer class="foot">
          <ui2-button
            variant="ghost"
            iconLeft="logout"
            (clicked)="cerrarSesion()"
          >
            Cerrar sesión
          </ui2-button>
        </footer>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .screen {
        min-height: 100vh;
        min-height: 100dvh;
        background:
          radial-gradient(
            120% 60% at 50% -10%,
            rgba(231, 92, 62, 0.08),
            transparent 60%
          ),
          var(--cream-50, #faf6ef);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 20px;
        box-sizing: border-box;
      }

      .screen__inner {
        width: 100%;
        max-width: 480px;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }

      /* ---------- Hero ---------- */
      .hero {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: hero-in 520ms ease-out both;
      }
      .hero__overline {
        font: 700 11px/1 'Galvji', system-ui, sans-serif;
        letter-spacing: 1.6px;
        color: var(--kengo-primary, #e75c3e);
        text-transform: uppercase;
      }
      .hero__title {
        font-family: 'KengoDisplay', 'Galvji', serif;
        font-weight: 400;
        font-size: clamp(34px, 6.5vw, 44px);
        line-height: 1.05;
        color: var(--ink-900, #111);
        margin: 6px 0 4px;
        letter-spacing: -0.5px;
      }
      .hero__sub {
        font: 500 14px/1.55 'Galvji', system-ui, sans-serif;
        color: var(--ink-500, #6b6b6b);
        max-width: 38ch;
        margin: 0 auto;
      }

      /* ---------- Options ---------- */
      .options {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .options__item {
        animation: option-in 460ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
        animation-delay: calc(180ms + var(--i, 0) * 70ms);
      }

      .option {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid var(--ink-100, #ece5da);
        border-radius: 22px;
        box-shadow:
          var(--shadow-card, 0 1px 0 rgba(17, 17, 17, 0.04)),
          0 1px 2px rgba(17, 17, 17, 0.03);
        cursor: pointer;
        text-align: left;
        font-family: inherit;
        transition:
          transform 0.18s ease,
          box-shadow 0.22s ease,
          border-color 0.22s ease;
      }
      .option:hover {
        transform: translateY(-2px);
        box-shadow:
          var(
            --shadow-card-strong,
            0 14px 28px -14px rgba(17, 17, 17, 0.18)
          ),
          0 2px 4px rgba(17, 17, 17, 0.04);
        border-color: var(--kengo-primary-light, #f1ad96);
      }
      .option:active {
        transform: translateY(0);
      }
      .option:focus-visible {
        outline: 2px solid var(--kengo-primary, #e75c3e);
        outline-offset: 3px;
      }

      .option__body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }
      .option__name {
        font: 600 16px/1.2 'KengoDisplay', 'Galvji', serif;
        color: var(--ink-900, #111);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        letter-spacing: -0.2px;
      }
      .option__chevron {
        color: var(--ink-400, #9a9a9a);
        font-size: 22px;
        flex-shrink: 0;
        transition:
          transform 0.22s ease,
          color 0.22s ease;
      }
      .option:hover .option__chevron {
        color: var(--kengo-primary, #e75c3e);
        transform: translateX(3px);
      }

      /* ---------- Footer ---------- */
      .foot {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 4px;
        animation: hero-in 520ms ease-out both;
        animation-delay: 320ms;
      }

      /* ---------- Animations ---------- */
      @keyframes hero-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes option-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .hero,
        .options__item,
        .foot {
          animation: none;
        }
        .option,
        .option__chevron {
          transition: none;
        }
      }

      /* ---------- Desktop tweaks ---------- */
      @media (min-width: 768px) {
        .screen {
          padding: 64px 24px;
        }
        .option {
          padding: 16px 18px;
        }
      }
    `,
  ],
})
export class SeleccionarClinicaComponent {
  private auth = inject(AuthService);
  private session = inject(SessionService);
  private clinicasService = inject(ClinicasService);
  private clinicaActiva = inject(ClinicaActivaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly opciones = computed<OpcionClinica[]>(() => {
    const clinicas = this.clinicasService.misClinicas();
    const membresias = this.session.misclinicas();
    return clinicas.map((c) => ({
      clinicId: c.id,
      nombre: c.nombre,
      puesto: membresias.find((m) => m.clinicId === c.id)?.puesto ?? '',
      logo: c.logo ?? null,
    }));
  });

  // Si llegamos aquí pero ya hay una clínica activa válida (race / navegación
  // directa), redirigir al destino sin obligar a re-elegir.
  private readonly autoNavega = effect(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    const ids = this.opciones().map((o) => o.clinicId);
    if (id && ids.includes(id) && ids.length > 0) {
      this.continuar();
    }
  });

  protected puestoLabel(p: string): string {
    if (p === 'admin') return 'Administrador';
    if (p === 'fisio') return 'Fisioterapeuta';
    if (p === 'paciente') return 'Paciente';
    return '—';
  }

  protected puestoIcon(p: string): string {
    if (p === 'admin') return 'shield_person';
    if (p === 'fisio') return 'medical_services';
    if (p === 'paciente') return 'person';
    return 'help';
  }

  protected puestoVariant(p: string): Ui2PillVariant {
    if (p === 'admin') return 'primary';
    if (p === 'fisio') return 'soft';
    if (p === 'paciente') return 'neutral';
    return 'neutral';
  }

  protected elegir(clinicId: string): void {
    this.clinicaActiva.set(clinicId);
    this.continuar();
  }

  protected async cerrarSesion(): Promise<void> {
    await this.auth.logout();
  }

  private continuar(): void {
    const next = this.route.snapshot.queryParamMap.get('next') ?? '/inicio';
    this.router.navigateByUrl(next);
  }
}
