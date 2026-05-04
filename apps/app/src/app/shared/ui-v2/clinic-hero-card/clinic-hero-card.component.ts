import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

const FALLBACK_IMAGE = 'assets/portadas/clinica.webp';

/**
 * Clinic hero card V2 — tarjeta visual con imagen de fondo + overlay oscuro
 * que destaca la clínica del paciente. Si `imageUrl` es null usa fallback estático.
 */
@Component({
  selector: 'ui2-clinic-hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="ui2-clinic" (click)="cardClick.emit($event)">
      <span class="ui2-clinic__bg" [style.background-image]="bgUrl()"></span>
      <span class="ui2-clinic__overlay"></span>
      <span class="ui2-clinic__content">
        <span class="ui2-clinic__top">
          <span class="ui2-clinic__overline">{{ label() }}</span>
          <span class="ui2-clinic__name">{{ name() }}</span>
        </span>
        @if (address() || phone()) {
          <span class="ui2-clinic__meta">
            @if (address()) {
              <span class="ui2-clinic__meta-item">
                <span class="material-symbols-outlined ui2-clinic__icon" aria-hidden="true">location_on</span>
                {{ address() }}
              </span>
            }
            @if (address() && phone()) {
              <span class="ui2-clinic__sep">·</span>
            }
            @if (phone()) {
              <span class="ui2-clinic__meta-item">
                <span class="material-symbols-outlined ui2-clinic__icon" aria-hidden="true">phone</span>
                {{ phone() }}
              </span>
            }
          </span>
        }
      </span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .ui2-clinic {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: 2.5 / 1;
      border: 0;
      padding: 0;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: var(--shadow-card-strong);
      cursor: pointer;
      color: white;
      font: inherit;
      text-align: left;
      transition: transform 0.15s ease;
    }
    .ui2-clinic:active { transform: translateY(1px); }
    .ui2-clinic__bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
    .ui2-clinic__overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%);
    }
    .ui2-clinic__content {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
    }
    .ui2-clinic__top { display: block; }
    .ui2-clinic__overline {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.85);
    }
    .ui2-clinic__name {
      display: block;
      font-family: KengoDisplay, kengoFont, sans-serif;
      font-size: 18px;
      line-height: 1;
      letter-spacing: 0.2px;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .ui2-clinic__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: white;
    }
    .ui2-clinic__meta-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .ui2-clinic__icon {
      font-size: 12px;
      font-variation-settings: 'wght' 600;
    }
    .ui2-clinic__sep { opacity: 0.5; }
  `],
})
export class Ui2ClinicHeroCardComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input<string | null>(null);
  readonly address = input<string | null>(null);
  readonly phone = input<string | null>(null);
  readonly label = input<string>('Mi clínica');

  readonly cardClick = output<MouseEvent>();

  readonly bgUrl = computed(() => `url('${this.imageUrl() ?? FALLBACK_IMAGE}')`);
}
