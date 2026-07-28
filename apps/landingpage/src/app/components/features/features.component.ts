import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

interface FeatureRow {
  id?: string;
  num: string;
  titleHtml: string;
  copy: string;
  ticks: string[];
  img: { src: string; width: number; height: number; alt: string; small?: boolean };
  reversed?: boolean;
  band?: 'sand' | 'soft';
  bleed?: 'left' | 'right';
}

@Component({
  selector: 'web-features',
  standalone: true,
  imports: [ScrollAnimateDirective],
  template: `
    @for (f of features; track f.num) {
      <section
        class="feat"
        [class.rev]="f.reversed"
        [class.band-sand]="f.band === 'sand'"
        [class.band-soft]="f.band === 'soft'"
        [class.bleed-left]="f.bleed === 'left'"
        [class.bleed-right]="f.bleed === 'right'"
        [id]="f.id || null"
      >
        <div class="wrap feat-in scroll-reveal" webScrollAnimate>
          <div>
            <span class="num font-display">{{ f.num }}</span>
            <h3 class="font-display" [innerHTML]="f.titleHtml"></h3>
            <p>{{ f.copy }}</p>
            <ul class="ticks">
              @for (t of f.ticks; track t) {
                <li>{{ t }}</li>
              }
            </ul>
          </div>
          <div class="mock-wrap">
            <img
              class="mock"
              [class.mock-sm]="f.img.small"
              [src]="f.img.src"
              [width]="f.img.width"
              [height]="f.img.height"
              [alt]="f.img.alt"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .feat {
        padding: 112px 0;
        position: relative;
      }

      .feat-in {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 64px;
        align-items: center;
      }

      .feat.rev .feat-in > .mock-wrap {
        order: -1;
      }

      .num {
        font-size: 15px;
        letter-spacing: 0.22em;
        color: #9a5236;
        text-transform: none;
      }

      h3 {
        margin: 14px 0 0;
        font-size: clamp(28px, 3.2vw, 44px);
        line-height: 1.02;
        letter-spacing: 0.015em;
        color: var(--color-ink);
      }

      p {
        margin: 20px 0 0;
        font-size: 17px;
        line-height: 1.68;
        color: var(--color-ink-700);
        max-width: 30em;
      }

      /* Bandas */
      .band-sand {
        background: var(--color-sand);
      }

      .band-soft {
        background: var(--color-mist);
        padding-bottom: 0;
        overflow: hidden;
      }
      .band-soft .mock-wrap {
        align-self: end;
        align-items: flex-end;
      }
      .band-soft .mock {
        margin-bottom: -1px;
      }
      .band-soft .num {
        color: #3f6b45;
      }
      .band-soft .ticks li::before {
        background-color: rgba(93, 138, 95, 0.14);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d8a5f' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
      }

      /* Sangrados */
      .bleed-right {
        overflow: hidden;
      }
      .bleed-left {
        overflow: hidden;
        padding-bottom: 0;
      }
      .bleed-left .mock-wrap {
        justify-content: flex-start;
        align-items: flex-end;
        align-self: end;
        margin-left: calc(-1 * max(32px, 50vw - 588px));
      }
      .bleed-left .mock {
        margin: 0 auto 0 0;
        max-width: 640px;
      }
      .bleed-right .mock-wrap {
        justify-content: flex-end;
        margin-right: calc(-1 * max(32px, 50vw - 588px));
      }
      .bleed-right .mock {
        margin-right: 0;
        max-width: 620px;
      }

      @media (max-width: 1080px) {
        .feat-in {
          grid-template-columns: 1fr;
          gap: 44px;
        }
        .feat.rev .feat-in > .mock-wrap {
          order: 0;
        }
        .bleed-right .mock-wrap {
          margin-right: calc(-1 * max(20px, 50vw - 588px));
        }
        .bleed-left .mock-wrap {
          margin-left: calc(-1 * max(20px, 50vw - 588px));
        }
      }

      @media (max-width: 640px) {
        .feat {
          padding: 76px 0;
        }
      }
    `,
  ],
})
export class FeaturesComponent {
  features: FeatureRow[] = [
    {
      id: 'fisios',
      num: '01 — Catálogo',
      titleHtml: 'Más de 500<br>ejercicios. Ninguno<br>que grabar tú.',
      copy: 'Un catálogo grabado con fisioterapeutas, filtrado por región corporal y material. Búscalo, marca favoritos y arrástralo al plan.',
      ticks: [
        'Vídeo profesional en cada ficha, con descripción de ejecución',
        'Filtros por zona, material y fase del protocolo',
        'Vista de cuadrícula o lista, con favoritos siempre a mano',
      ],
      img: {
        src: 'assets/shots/ejercicios.png',
        width: 1500,
        height: 1134,
        alt: 'Catálogo de ejercicios de Kengo',
      },
      reversed: true,
      bleed: 'left',
    },
    {
      num: '02 — Rutinas',
      titleHtml: 'Tus protocolos,<br>guardados una vez',
      copy: 'Esguince fase 1, condromalacia, movilidad de hombro… Guarda lo que funciona como rutina y compártelo con el resto de la clínica. El siguiente paciente tarda dos minutos.',
      ticks: [
        'Rutinas privadas o compartidas con toda la clínica',
        'Asignación por días de la semana con series y repeticiones',
        'Duplica y ajusta sin partir de cero',
      ],
      img: {
        src: 'assets/shots/rutinas.png',
        width: 1500,
        height: 1253,
        alt: 'Rutinas guardadas en Kengo',
      },
      band: 'sand',
      bleed: 'right',
    },
    {
      id: 'pacientes',
      num: '03 — Sesión guiada',
      titleHtml: 'En casa, pero<br>como en consulta',
      copy: 'El paciente abre la app y solo tiene que seguirla: vídeo a pantalla completa, contador de series y descanso cronometrado. Sin dudas sobre si lo está haciendo bien.',
      ticks: [
        'Vídeo, series y repeticiones en la misma pantalla',
        'Registro de dolor y dificultad al terminar',
        'Racha de días y progreso visible sesión a sesión',
      ],
      img: {
        src: 'assets/shots/ejercicio.png',
        width: 1500,
        height: 1969,
        alt: 'Sesión guiada con vídeo en Kengo',
        small: true,
      },
      reversed: true,
      band: 'soft',
    },
    {
      num: '04 — Seguimiento',
      titleHtml: 'Deja de preguntar<br>«¿has hecho los<br>ejercicios?»',
      copy: 'Adherencia, sesiones, evolución del dolor y racha, por paciente y en tiempo real. Las alertas te avisan de quién lleva días sin abrir la app antes de que se descuelgue.',
      ticks: [
        'Alertas de inactividad y de tendencia negativa',
        'Escala de dolor registrada por el propio paciente',
        'Planes por vencer, ordenados por urgencia',
      ],
      img: {
        src: 'assets/shots/stats.png',
        width: 1500,
        height: 1952,
        alt: 'Seguimiento de adherencia de un paciente',
        small: true,
      },
    },
    {
      num: '05 — Mensajes',
      titleHtml: 'Ajusta el plan<br>sin esperar<br>a la próxima cita',
      copy: 'Si algo molesta, el paciente lo cuenta ese mismo día. Tú cambias series, repeticiones o el ejercicio entero, y lo ve al instante en su plan.',
      ticks: [
        'Conversación por paciente, dentro de la propia app',
        'Confirmación de lectura y aviso por notificación',
        'Los cambios del plan se sincronizan al momento',
      ],
      img: {
        src: 'assets/shots/chat.png',
        width: 1500,
        height: 1644,
        alt: 'Chat entre fisio y paciente en Kengo',
      },
      reversed: true,
      band: 'sand',
    },
  ];
}
