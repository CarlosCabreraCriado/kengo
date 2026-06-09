import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { SessionService } from '../../../../core/auth/services/session.service';
import { AuthService } from '../../../../core/auth/services/auth.service';

/**
 * Banner global de impersonación. Se monta en el shell raíz y solo se muestra
 * cuando hay una impersonación activa (`SessionService.estaImpersonando`). Es un
 * elemento de seguridad: el técnico debe saber en todo momento que está actuando
 * como otro usuario y poder salir en un clic.
 */
@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.estaImpersonando()) {
      <div class="imp-banner" role="status" aria-live="polite">
        <span class="material-symbols-outlined imp-banner__icon" aria-hidden="true"
          >visibility</span
        >
        <span class="imp-banner__label">
          Viendo como
          <strong>{{ session.impersonacion()?.targetNombre }}</strong>
        </span>
        <button
          type="button"
          class="imp-banner__exit"
          [disabled]="saliendo()"
          (click)="salir()"
        >
          {{ saliendo() ? 'Saliendo…' : 'Salir' }}
        </button>
      </div>
    }
  `,
  styles: [
    `
      .imp-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: var(--z-banner);
        box-sizing: border-box;
        /* Altura idéntica al espacio reservado por los shells (ver styles.css y
           app.component.css) para que no haya solape ni hueco. */
        height: var(--imp-banner-h);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: env(safe-area-inset-top, 0px) 16px 0;
        background: var(--coral-gradient, var(--kengo-primary));
        color: #fff;
        font-size: 14px;
        box-shadow: var(--shadow-card);
      }
      .imp-banner__icon {
        font-size: 18px;
      }
      .imp-banner__label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .imp-banner__exit {
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 9999px;
        padding: 4px 14px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }
      .imp-banner__exit:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class ImpersonationBannerComponent {
  readonly session = inject(SessionService);
  private auth = inject(AuthService);
  readonly saliendo = signal(false);

  async salir(): Promise<void> {
    this.saliendo.set(true);
    try {
      await this.auth.salirDeImpersonacion();
    } finally {
      this.saliendo.set(false);
    }
  }
}
