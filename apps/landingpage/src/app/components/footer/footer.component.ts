import { Component, signal, inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

type ContactState = 'form' | 'sending' | 'success' | 'error';

@Component({
  selector: 'web-footer',
  standalone: true,
  imports: [ReactiveFormsModule, ScrollAnimateDirective],
  template: `
    <footer>
      <div class="wrap">
        <div class="foot-top scroll-reveal" webScrollAnimate>
          <div class="foot-brand">
            <a href="#top" aria-label="Kengo — inicio">
              <img src="logo-kengo-horizontal.svg" alt="Kengo" />
            </a>
            <p>
              La plataforma que mantiene el tratamiento vivo entre sesión y
              sesión.
            </p>
          </div>
          <div class="foot-cols">
            <div class="foot-col">
              <h5>Producto</h5>
              <a href="#fisios">Para fisios</a>
              <a href="#pacientes">Para pacientes</a>
              <a href="#clinicas">Clínicas</a>
              <a href="#como">Cómo funciona</a>
            </div>
            <div class="foot-col">
              <h5>Empresa</h5>
              <a href="#top">Sobre Kengo</a>
              <button type="button" class="foot-link" (click)="abrirModal()">
                Contacto
              </button>
              <button type="button" class="foot-link" (click)="abrirModal()">
                Soporte
              </button>
            </div>
            <div class="foot-col">
              <h5>Legal</h5>
              <a href="#top">Privacidad</a>
              <a href="#top">Términos</a>
              <a href="#top">Cookies</a>
            </div>
          </div>
        </div>
        <div class="foot-bot">
          <span>&copy; {{ currentYear }} Kengo. Todos los derechos reservados.</span>
          <span>Hecho en Canarias</span>
        </div>
      </div>
    </footer>

    <!-- Modal de contacto -->
    @if (modalAbierto()) {
      <div
        class="modal-overlay"
        role="button"
        tabindex="0"
        aria-label="Cerrar contacto"
        (click)="onBackdrop($event)"
        (keydown.escape)="cerrarModal()"
      >
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Contacto</h3>
            <button
              (click)="cerrarModal()"
              class="modal-close"
              aria-label="Cerrar"
            >
              <svg
                class="h-5 w-5"
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
            </button>
          </div>

          <div class="modal-body">
            @switch (estado()) {
              @case ('form') {
                <form [formGroup]="contactForm" (ngSubmit)="enviar()">
                  <div class="form-group">
                    <label for="nombre" class="form-label">Nombre *</label>
                    <input
                      id="nombre"
                      type="text"
                      formControlName="nombre"
                      class="form-input"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div class="form-group">
                    <label for="email" class="form-label">Email *</label>
                    <input
                      id="email"
                      type="email"
                      formControlName="email"
                      class="form-input"
                      placeholder="tu&#64;email.com"
                    />
                  </div>

                  <div class="form-group">
                    <label for="asunto" class="form-label">Asunto</label>
                    <input
                      id="asunto"
                      type="text"
                      formControlName="asunto"
                      class="form-input"
                      placeholder="Asunto del mensaje"
                    />
                  </div>

                  <div class="form-group">
                    <label for="mensaje" class="form-label">Mensaje *</label>
                    <textarea
                      id="mensaje"
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
                    Enviar mensaje
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
                    (click)="cerrarModal()"
                    class="submit-btn"
                    style="margin-top: 16px;"
                  >
                    Cerrar
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
                    No se pudo enviar el mensaje. Inténtalo de nuevo.
                  </p>
                  <button
                    (click)="estado.set('form')"
                    class="submit-btn"
                    style="margin-top: 16px;"
                  >
                    Reintentar
                  </button>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      footer {
        background: var(--color-cream);
        border-top: 1px solid var(--color-ink-200);
        color: var(--color-ink-700);
        padding: 64px 0 40px;
        font-size: 14px;
      }

      .foot-top {
        display: flex;
        justify-content: space-between;
        gap: 40px;
        flex-wrap: wrap;
        padding-bottom: 40px;
        border-bottom: 1px solid var(--color-ink-200);
      }

      .foot-brand {
        max-width: 280px;
      }

      .foot-brand img {
        height: 32px;
      }

      .foot-brand p {
        margin: 18px 0 0;
        font-size: 14px;
        line-height: 1.6;
      }

      .foot-cols {
        display: flex;
        gap: 72px;
        flex-wrap: wrap;
      }

      .foot-col h5 {
        margin: 0 0 14px;
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #a34a2c;
        font-weight: 700;
      }

      .foot-col a,
      .foot-col .foot-link {
        display: block;
        color: var(--color-ink-700);
        margin-bottom: 9px;
        text-decoration: none;
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        cursor: pointer;
        text-align: left;
      }

      .foot-col a:hover,
      .foot-col .foot-link:hover {
        color: var(--color-primary);
      }

      .foot-bot {
        padding-top: 26px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        font-size: 13px;
        color: #7d6b62;
      }

      /* ============ Modal ============ */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(67, 52, 44, 0.45);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
        animation: fadeIn 0.2s ease;
      }

      .modal-container {
        background: #fff;
        border: 1px solid var(--color-ink-200);
        border-radius: 24px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 60px rgba(150, 100, 70, 0.25);
        animation: slideUp 0.3s ease;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 24px 0;
      }

      .modal-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--color-ink);
        margin: 0;
      }

      .modal-close {
        background: var(--color-sand);
        border: 1px solid var(--color-ink-200);
        border-radius: 12px;
        color: var(--color-ink-700);
        cursor: pointer;
        padding: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-close:hover {
        background: var(--color-peach);
        color: var(--color-ink);
      }

      .modal-body {
        padding: 24px;
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

      .h-5 {
        width: 20px;
        height: 20px;
      }
      .h-8 {
        width: 32px;
        height: 32px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  modalAbierto = signal(false);
  estado = signal<ContactState>('form');

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  contactForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    asunto: [''],
    mensaje: ['', Validators.required],
  });

  onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.cerrarModal();
    }
  }

  abrirModal() {
    this.estado.set('form');
    this.contactForm.reset();
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
  }

  enviar() {
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
