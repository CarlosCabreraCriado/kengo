import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
// Solo los metadatos: el barrel `@kengo/legal` arrastraría al bundle de la
// home los cuatro textos legales completos (~70 kB).
import { LEGAL_DOCS } from '@kengo/legal/metadata';
import { environment } from '../../../environments/environment';
import {
  CONTACT_EMAIL,
  NUM_FISIOS_OPCIONES,
  PLAZO_RESPUESTA,
  PREFERENCIAS_CONTACTO,
} from '../../shared/site-config';

type LeadState = 'form' | 'sending' | 'success' | 'error';

/** Teléfono: 9–15 dígitos con `+` opcional, admitiendo espacios, guiones y puntos. */
const TELEFONO_PATTERN = /^\+?[\d\s\-.()]{9,20}$/;

/**
 * Formulario comercial «Te llamamos». Envía a `POST /api/leads/send`, que
 * guarda el lead en Convex (tabla `leads`) y avisa a info@.
 *
 * La casilla de privacidad es obligatoria y nunca va premarcada; junto al
 * envío viaja la `version` vigente de la política (`LEGAL_DOCS`) como prueba
 * de qué texto aceptó la persona.
 */
@Component({
  selector: 'web-lead-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @switch (estado()) {
      @case ('form') {
        <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <div class="grid">
            <div class="field">
              <label [for]="idPrefix() + '-nombre'">Tu nombre</label>
              <input [id]="idPrefix() + '-nombre'" type="text" formControlName="nombre" autocomplete="name" />
            </div>
            <div class="field">
              <label [for]="idPrefix() + '-clinica'">Clínica</label>
              <input [id]="idPrefix() + '-clinica'" type="text" formControlName="clinica" autocomplete="organization" />
            </div>
            <div class="field">
              <label [for]="idPrefix() + '-fisios'">Nº de fisios</label>
              <select [id]="idPrefix() + '-fisios'" formControlName="numFisios">
                <option value="" disabled>Elige</option>
                @for (op of numFisiosOpciones; track op) {
                  <option [value]="op">{{ op }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label [for]="idPrefix() + '-ciudad'">Ciudad</label>
              <input [id]="idPrefix() + '-ciudad'" type="text" formControlName="ciudad" autocomplete="address-level2" />
            </div>
            <div class="field">
              <label [for]="idPrefix() + '-telefono'">Teléfono</label>
              <input [id]="idPrefix() + '-telefono'" type="tel" inputmode="tel" formControlName="telefono" autocomplete="tel" />
            </div>
            <div class="field">
              <label [for]="idPrefix() + '-email'">Email</label>
              <input [id]="idPrefix() + '-email'" type="email" formControlName="email" autocomplete="email" />
            </div>
          </div>

          <fieldset class="pref">
            <legend>¿Cómo prefieres que te contactemos?</legend>
            <div class="pref-opts">
              @for (p of preferencias; track p.value) {
                <label class="chip">
                  <input type="radio" formControlName="preferenciaContacto" [value]="p.value" />
                  <span>{{ p.label }}</span>
                </label>
              }
            </div>
          </fieldset>

          <!-- Honeypot: invisible para personas; los bots lo rellenan. -->
          <div class="hp" aria-hidden="true">
            <label [for]="idPrefix() + '-website'">Web</label>
            <input [id]="idPrefix() + '-website'" type="text" formControlName="website" tabindex="-1" autocomplete="off" />
          </div>

          <label class="rgpd">
            <input type="checkbox" formControlName="aceptaPrivacidad" />
            <span>
              He leído y acepto la
              <a routerLink="/legal/privacidad" target="_blank" rel="noopener">política de privacidad</a>.
            </span>
          </label>
          <p class="rgpd-info">
            Responsable: KENGO S.C. Finalidad: atender tu solicitud y enviarte
            información de Kengo. No se ceden datos a terceros salvo obligación
            legal. Puedes ejercer tus derechos en {{ contactEmail }}.
          </p>

          @if (intentado() && form.invalid) {
            <p class="err" role="alert">
              Revisa los campos: todos son obligatorios y hay que aceptar la
              política de privacidad.
            </p>
          }

          <button type="submit" class="btn btn-primary submit">Quiero que me llaméis</button>
        </form>
      }
      @case ('sending') {
        <div class="state" role="status">
          <div class="spinner"></div>
          <p>Enviando…</p>
        </div>
      }
      @case ('success') {
        <div class="state" role="status">
          <div class="ok-icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="state-title">¡Gracias!</p>
          <p>Te contactamos en {{ plazo }}.</p>
        </div>
      }
      @case ('error') {
        <div class="state" role="alert">
          <p class="state-title">No se ha podido enviar</p>
          <p>
            {{ errorMsg() }} También puedes escribirnos a
            <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a>.
          </p>
          <button type="button" class="btn btn-ghost" (click)="estado.set('form')">
            Volver al formulario
          </button>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px 16px;
      }

      .field label,
      legend {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-ink-strong);
        margin-bottom: 6px;
      }

      input[type='text'],
      input[type='tel'],
      input[type='email'],
      select {
        width: 100%;
        box-sizing: border-box;
        background: var(--color-cream);
        border: 1px solid var(--color-ink-200);
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        font-size: 16px; /* 16px evita el zoom automático de iOS al enfocar */
        color: var(--color-ink);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      input:focus-visible,
      select:focus-visible {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(224, 112, 79, 0.18);
      }

      input.ng-invalid.ng-touched,
      select.ng-invalid.ng-touched {
        border-color: #b3412a;
      }

      .pref {
        border: 0;
        padding: 0;
        margin: 18px 0 0;
      }

      .pref-opts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        position: relative;
        cursor: pointer;
      }

      .chip input {
        position: absolute;
        opacity: 0;
        inset: 0;
        margin: 0;
        cursor: pointer;
      }

      .chip span {
        display: inline-block;
        padding: 9px 16px;
        border-radius: 999px;
        border: 1.5px solid var(--color-ink-200);
        background: var(--color-cream);
        font-size: 14px;
        font-weight: 600;
        color: var(--color-ink);
        transition: 0.2s;
      }

      .chip input:checked + span {
        border-color: var(--color-primary);
        background: var(--color-peach);
        color: var(--color-primary-dark);
      }

      .chip input:focus-visible + span {
        box-shadow: 0 0 0 3px rgba(224, 112, 79, 0.25);
      }

      .hp {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      .rgpd {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        margin-top: 20px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--color-ink-strong);
        cursor: pointer;
      }

      .rgpd input {
        flex: none;
        width: 18px;
        height: 18px;
        margin: 2px 0 0;
        accent-color: var(--color-primary);
      }

      .rgpd a,
      .state a {
        color: var(--color-primary-dark);
        font-weight: 600;
      }

      .rgpd-info {
        margin: 8px 0 0 28px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--color-ink-700);
      }

      .err {
        margin: 14px 0 0;
        font-size: 14px;
        color: #b3412a;
        font-weight: 600;
      }

      .submit {
        width: 100%;
        justify-content: center;
        margin-top: 20px;
      }

      .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
        padding: 40px 0;
        color: var(--color-ink-strong);
      }

      .state p {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
      }

      .state-title {
        font-size: 20px !important;
        font-weight: 700;
      }

      .ok-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(93, 138, 95, 0.16);
        color: #3f6b45;
        display: grid;
        place-items: center;
      }

      .ok-icon svg {
        width: 30px;
        height: 30px;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--color-ink-200);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 520px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LeadFormComponent {
  /**
   * Prefijo de los `id` de los campos. El formulario puede estar dos veces en
   * la página (sección `#contacto` y popup del botón flotante) y los `id`
   * repetidos rompen la asociación label ↔ campo.
   */
  readonly idPrefix = input('lead');

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly numFisiosOpciones = NUM_FISIOS_OPCIONES;
  protected readonly preferencias = PREFERENCIAS_CONTACTO;
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly plazo = PLAZO_RESPUESTA;

  protected readonly estado = signal<LeadState>('form');
  protected readonly intentado = signal(false);
  protected readonly errorMsg = signal('');

  protected readonly form = this.fb.group({
    nombre: ['', Validators.required],
    clinica: ['', Validators.required],
    numFisios: ['', Validators.required],
    ciudad: ['', Validators.required],
    telefono: ['', [Validators.required, Validators.pattern(TELEFONO_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    preferenciaContacto: ['telefono', Validators.required],
    aceptaPrivacidad: [false, Validators.requiredTrue],
    website: [''],
  });

  protected enviar(): void {
    this.intentado.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.estado.set('sending');
    this.http
      .post<{ success: boolean; message?: string }>(
        `${environment.convexSiteUrl}/api/leads/send`,
        { ...this.form.getRawValue(), privacidadVersion: LEGAL_DOCS.privacidad.version },
      )
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.estado.set('success');
          } else {
            this.fallo(res?.message);
          }
        },
        error: (err: { error?: { message?: string } }) => this.fallo(err?.error?.message),
      });
  }

  private fallo(message?: string): void {
    this.errorMsg.set(message ? `${message}.` : 'Ha habido un problema de conexión.');
    this.estado.set('error');
  }
}
