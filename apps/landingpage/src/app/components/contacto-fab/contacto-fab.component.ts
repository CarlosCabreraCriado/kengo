import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LeadFormComponent } from '../lead-form/lead-form.component';
import { ContactoDialogService } from '../../shared/contacto-dialog.service';
import { PLAZO_RESPUESTA } from '../../shared/site-config';

/**
 * Botón flotante permanente que abre el formulario «Te llamamos» en un popup.
 *
 * Usa `<dialog>` nativo con `showModal()`: atrapa el foco, cierra con Escape y
 * oscurece el fondo sin librerías. El formulario solo se monta con el popup
 * abierto, así no se duplica en el HTML prerenderizado.
 *
 * El botón se esconde mientras la sección `#demo` está en pantalla, porque ahí
 * el formulario ya está a la vista.
 */
@Component({
  selector: 'web-contacto-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LeadFormComponent],
  template: `
    <button
      type="button"
      class="fab"
      [class.oculto]="demoVisible()"
      [attr.aria-hidden]="demoVisible() ? 'true' : null"
      [attr.tabindex]="demoVisible() ? -1 : null"
      aria-haspopup="dialog"
      aria-label="¿Hablamos? Déjanos tus datos y te llamamos"
      (click)="dialogo.abrir()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      <span class="txt">¿Hablamos?</span>
    </button>

    <dialog
      #dlg
      class="dlg"
      aria-labelledby="contacto-pop-titulo"
      (close)="dialogo.cerrar()"
    >
      <div class="dlg-in">
        <button type="button" class="cerrar" aria-label="Cerrar" (click)="dialogo.cerrar()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h2 id="contacto-pop-titulo">Te llamamos</h2>
        <p class="sub">
          Déjanos tus datos y te contactamos en {{ plazo }}: demo, precio para
          tu clínica o ideas para monetizar Kengo.
        </p>
        @if (dialogo.abierto()) {
          <web-lead-form idPrefix="lead-pop" />
        }
      </div>
    </dialog>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .fab {
        position: fixed;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 90; /* por debajo del nav (100) para no tapar el menú móvil */
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 56px;
        padding: 0 22px 0 18px;
        border: 0;
        border-radius: 999px;
        background: var(--color-primary);
        color: #fff;
        font-family: inherit;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 26px rgba(224, 112, 79, 0.36);
        transition:
          transform 0.2s,
          opacity 0.25s,
          background 0.2s;
      }

      .fab:hover {
        background: var(--color-primary-dark);
        transform: translateY(-2px);
      }

      .fab:focus-visible {
        outline: 3px solid var(--color-ink-strong);
        outline-offset: 3px;
      }

      .fab.oculto {
        opacity: 0;
        transform: translateY(12px);
        pointer-events: none;
      }

      .fab svg {
        width: 24px;
        height: 24px;
        flex: none;
      }

      .dlg {
        /* El reset global quita el margin: auto nativo que centra el <dialog>. */
        margin: auto;
        width: min(620px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px);
        padding: 0;
        border: 0;
        border-radius: 28px;
        background: #fff;
        color: var(--color-ink);
        box-shadow: 0 24px 64px rgba(43, 38, 32, 0.28);
        overflow: auto;
        overscroll-behavior: contain;
      }

      .dlg::backdrop {
        background: rgba(43, 38, 32, 0.55);
        backdrop-filter: blur(2px);
      }

      .dlg-in {
        position: relative;
        padding: 32px;
      }

      .dlg h2 {
        margin: 0;
        padding-right: 44px;
        font-size: 24px;
        font-weight: 700;
        color: var(--color-ink-strong);
      }

      .sub {
        margin: 8px 0 22px;
        font-size: 15px;
        line-height: 1.55;
        color: var(--color-ink-700);
      }

      .cerrar {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: var(--color-sand);
        color: var(--color-ink-strong);
        cursor: pointer;
      }

      .cerrar:hover {
        background: var(--color-ink-200);
      }

      .cerrar:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }

      .cerrar svg {
        width: 20px;
        height: 20px;
      }

      @media (max-width: 640px) {
        /* En móvil, solo el icono: el texto taparía demasiado contenido. */
        .fab {
          width: 56px;
          padding: 0;
          justify-content: center;
        }
        .txt {
          display: none;
        }
        .dlg-in {
          padding: 24px 20px;
        }
        .cerrar {
          top: 14px;
          right: 14px;
        }
      }
    `,
  ],
})
export class ContactoFabComponent {
  protected readonly dialogo = inject(ContactoDialogService);
  protected readonly plazo = PLAZO_RESPUESTA;
  protected readonly demoVisible = signal(false);

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.dialogo.abierto()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });

    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    let observer: IntersectionObserver | null = null;
    let espera: MutationObserver | null = null;
    destroyRef.onDestroy(() => {
      observer?.disconnect();
      espera?.disconnect();
    });

    afterNextRender(() => {
      // Clic en el backdrop: el evento llega con el propio <dialog> como target
      // (el contenido va en .dlg-in). Por teclado ya cierra Escape, nativo.
      const el = this.dlg().nativeElement;
      const alClicar = (event: MouseEvent) => {
        if (event.target === el) this.dialogo.cerrar();
      };
      el.addEventListener('click', alClicar);
      destroyRef.onDestroy(() => el.removeEventListener('click', alClicar));

      if (typeof IntersectionObserver === 'undefined') return;
      observer = new IntersectionObserver(
        ([entrada]) => this.demoVisible.set(!!entrada?.isIntersecting),
        { threshold: 0.15 },
      );
      const observar = (): boolean => {
        const demo = document.getElementById('demo');
        if (demo) observer?.observe(demo);
        return !!demo;
      };
      if (observar()) return;
      // #demo no lleva @defer, pero por si acaso llega más tarde al DOM.
      espera = new MutationObserver(() => {
        if (observar()) espera?.disconnect();
      });
      espera.observe(document.body, { childList: true, subtree: true });
    });
  }
}
