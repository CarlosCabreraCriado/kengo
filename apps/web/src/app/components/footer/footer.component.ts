import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ReactiveFormsModule, ScrollAnimateDirective],
  template: `
    <footer class="footer-section relative z-10 overflow-hidden">
      <!-- Top Wave Decoration -->
      <div class="footer-wave">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0V120Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div class="footer-content">
        <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div
            class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8"
          >
            <!-- Brand Column -->
            <div class="scroll-reveal-left lg:col-span-5" scrollAnimate>
              <a href="/" class="mb-6 inline-block">
                <img
                  src="logo-kengo-horizontal.svg"
                  alt="Kengo"
                  class="h-10"
                />
              </a>
              <p class="mb-8 max-w-md text-base leading-relaxed text-gray-400">
                Tu fisio, siempre contigo. Planes de ejercicios personalizados
                con videos guiados, seguimiento de progreso y conexión directa
                con tu fisioterapeuta.
              </p>

            </div>

            <!-- Links Columns -->
            <div class="scroll-reveal-right lg:col-span-7" scrollAnimate>
              <div class="grid grid-cols-2 gap-8">
                <!-- Product -->
                <div>
                  <h4 class="footer-heading">Producto</h4>
                  <ul class="footer-links">
                    <li><a href="#beneficios">Beneficios</a></li>
                    <li><a href="#como-funciona">Cómo funciona</a></li>
                    <li>
                      <a href="https://kengoapp.com/login">Registrarse</a>
                    </li>
                  </ul>
                </div>

                <!-- Contact -->
                <div>
                  <h4 class="footer-heading">Contacto</h4>
                  <ul class="footer-links">
                    <li>
                      <button (click)="abrirModal()" class="contact-btn">
                        <svg
                          class="mr-2 h-4 w-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                          />
                        </svg>
                        Escríbenos
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Bar -->
          <div class="footer-bottom scroll-reveal" scrollAnimate>
            <div
              class="flex flex-col items-center justify-between gap-4 md:flex-row"
            >
              <p class="text-sm text-gray-500">
                &copy; {{ currentYear }} Kengo. Todos los derechos reservados.
              </p>

              <!-- Made with love -->
              <p class="flex items-center gap-1 text-sm text-gray-500">
                Hecho con
                <span class="text-primary">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
                en España
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>

    <!-- Modal de contacto -->
    @if (modalAbierto()) {
      <div class="modal-overlay" (click)="cerrarModal()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <!-- Header del modal -->
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

          <!-- Contenido del modal -->
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
      .footer-section {
        position: relative;
        background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
      }

      .footer-wave {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 120px;
        color: #ffffff;
        transform: translateY(-99%);
      }

      .footer-wave svg {
        width: 100%;
        height: 100%;
      }

      .footer-content {
        position: relative;
        z-index: 1;
      }

      .footer-heading {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 20px;
      }

      .footer-links {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .footer-links li {
        margin-bottom: 12px;
      }

      .footer-links a {
        color: #9ca3af;
        font-size: 15px;
        text-decoration: none;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
      }

      .footer-links a:hover {
        color: #e75c3e;
        transform: translateX(4px);
      }

      .contact-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 15px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        padding: 0;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .contact-btn:hover {
        color: #e75c3e;
        transform: translateX(4px);
      }
      .footer-bottom {
        margin-top: 48px;
        padding-top: 32px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      /* Modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
        animation: fadeIn 0.2s ease;
      }

      .modal-container {
        background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
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
        color: #ffffff;
        margin: 0;
      }

      .modal-close {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: #9ca3af;
        cursor: pointer;
        padding: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
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
        font-weight: 500;
        color: #9ca3af;
        margin-bottom: 6px;
      }

      .form-input {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 15px;
        color: #ffffff;
        font-family: inherit;
        transition: border-color 0.2s ease;
        box-sizing: border-box;
      }

      .form-input::placeholder {
        color: #4b5563;
      }

      .form-input:focus {
        outline: none;
        border-color: #e75c3e;
        box-shadow: 0 0 0 3px rgba(231, 92, 62, 0.15);
      }

      .form-textarea {
        resize: vertical;
        min-height: 100px;
      }

      .submit-btn {
        width: 100%;
        background: #e75c3e;
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 14px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .submit-btn:hover:not(:disabled) {
        background: #d4503a;
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
        font-weight: 600;
        color: #ffffff;
        margin: 16px 0 8px;
      }

      .state-text {
        font-size: 14px;
        color: #9ca3af;
        margin: 0;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #e75c3e;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .success-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
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

  contactForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    this.contactForm = this.fb.group({
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      asunto: [''],
      mensaje: ['', Validators.required],
    });
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
      .post<{
        success: boolean;
      }>(`${environment.apiUrl}/contacto`, this.contactForm.value)
      .subscribe({
        next: () => this.estado.set('success'),
        error: () => this.estado.set('error'),
      });
  }
}
