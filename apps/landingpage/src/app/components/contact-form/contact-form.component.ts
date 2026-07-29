import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type ContactState = 'form' | 'sending' | 'success' | 'error';

/**
 * Formulario de contacto reutilizable.
 *
 * Se usa desde el modal del footer y desde la página de soporte
 * (`/soporte`), que es la Support URL que se declara en App Store Connect y
 * Play Console. Al vivir en un único componente, ambos comparten validación,
 * estados y endpoint.
 */
@Component({
  selector: 'web-contact-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @switch (estado()) {
      @case ('form') {
        <form [formGroup]="contactForm" (ngSubmit)="enviar()">
          <div class="form-group">
            <label [attr.for]="idPrefix() + '-nombre'" class="form-label">Nombre *</label>
            <input
              [id]="idPrefix() + '-nombre'"
              type="text"
              formControlName="nombre"
              class="form-input"
              placeholder="Tu nombre"
              autocomplete="name"
            />
          </div>

          <div class="form-group">
            <label [attr.for]="idPrefix() + '-email'" class="form-label">Email *</label>
            <input
              [id]="idPrefix() + '-email'"
              type="email"
              formControlName="email"
              class="form-input"
              placeholder="tu&#64;email.com"
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label [attr.for]="idPrefix() + '-asunto'" class="form-label">Asunto</label>
            <input
              [id]="idPrefix() + '-asunto'"
              type="text"
              formControlName="asunto"
              class="form-input"
              [placeholder]="asuntoPlaceholder()"
            />
          </div>

          <div class="form-group">
            <label [attr.for]="idPrefix() + '-mensaje'" class="form-label">Mensaje *</label>
            <textarea
              [id]="idPrefix() + '-mensaje'"
              formControlName="mensaje"
              class="form-input form-textarea"
              placeholder="Escribe tu mensaje..."
              rows="4"
            ></textarea>
          </div>

          <button
            type="submit"
            [disabled]="contactForm.invalid"
            class="submit-btn"
          >
            {{ submitLabel() }}
          </button>
        </form>
      }
      @case ('sending') {
        <div class="state-container">
          <div class="spinner"></div>
          <p class="state-text">Enviando mensaje...</p>
        </div>
      }
      @case ('success') {
        <div class="state-container">
          <div class="success-icon">
            <svg
              class="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p class="state-title">Mensaje enviado</p>
          <p class="state-text">Te responderemos lo antes posible.</p>
          <button
            type="button"
            (click)="reiniciar()"
            class="submit-btn"
            style="margin-top: 16px;"
          >
            Enviar otro mensaje
          </button>
        </div>
      }
      @case ('error') {
        <div class="state-container">
          <div class="error-icon">
            <svg
              class="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p class="state-title">Error al enviar</p>
          <p class="state-text">
            No se pudo enviar el mensaje. Inténtalo de nuevo o escríbenos a
            info&#64;kengoapp.com.
          </p>
          <button
            type="button"
            (click)="estado.set('form')"
            class="submit-btn"
            style="margin-top: 16px;"
          >
            Reintentar
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

      .form-group {
        margin-bottom: 16px;
      }

      .form-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-ink-700);
        margin-bottom: 6px;
      }

      .form-input {
        width: 100%;
        background: var(--color-cream);
        border: 1px solid var(--color-ink-200);
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 15px;
        color: var(--color-ink);
        font-family: inherit;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        box-sizing: border-box;
      }

      .form-input::placeholder {
        color: var(--color-ink-500);
      }

      .form-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(224, 112, 79, 0.15);
      }

      .form-textarea {
        resize: vertical;
        min-height: 100px;
      }

      .submit-btn {
        width: 100%;
        background: var(--color-primary);
        color: #fff;
        border: none;
        border-radius: 999px;
        padding: 14px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        box-shadow: 0 8px 22px rgba(224, 112, 79, 0.28);
      }

      .submit-btn:hover:not(:disabled) {
        background: var(--color-primary-dark);
        transform: translateY(-1px);
      }

      .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .state-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 0;
        text-align: center;
      }

      .state-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--color-ink);
        margin: 16px 0 8px;
      }

      .state-text {
        font-size: 14px;
        color: var(--color-ink-700);
        margin: 0;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--color-ink-200);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .success-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(93, 138, 95, 0.16);
        color: #3f6b45;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(224, 112, 79, 0.15);
        color: var(--color-primary-dark);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .h-8 {
        width: 32px;
        height: 32px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ContactFormComponent {
  /** Prefijo de los `id` para no colisionar si hay dos formularios en la página. */
  readonly idPrefix = input<string>('contacto');
  readonly submitLabel = input<string>('Enviar mensaje');
  readonly asuntoPlaceholder = input<string>('Asunto del mensaje');

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  protected estado = signal<ContactState>('form');

  protected contactForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    asunto: [''],
    mensaje: ['', Validators.required],
  });

  /** Devuelve el formulario a su estado inicial (lo usa el modal al abrirse). */
  reiniciar(): void {
    this.estado.set('form');
    this.contactForm.reset();
  }

  protected enviar(): void {
    if (this.contactForm.invalid) return;

    this.estado.set('sending');

    this.http
      .post<{ success: boolean }>(
        `${environment.convexSiteUrl}/api/contact/send`,
        this.contactForm.value,
      )
      .subscribe({
        next: (res) => this.estado.set(res?.success ? 'success' : 'error'),
        error: () => this.estado.set('error'),
      });
  }
}
