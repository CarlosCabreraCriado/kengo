import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'web-testimonials',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="testimonials-section" id="testimonios">
      <div class="bg-orb orb-1"></div>
      <div class="bg-orb orb-2"></div>

      <div class="content-wrapper">
        <!-- Header -->
        <div class="section-header">
          <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            Opiniones reales de fisios y pacientes
          </div>

          <h2 class="section-title">
            La diferencia se nota
            <span class="title-accent">en el seguimiento</span>
          </h2>

          <p class="section-subtitle">
            Menos dudas, más constancia y una forma mucho más clara de acompañar
            la recuperación dentro y fuera de consulta.
          </p>
        </div>

        <!-- Top controls -->
        <div class="carousel-toolbar">
          <div class="toolbar-info">
            <span class="toolbar-kicker">Testimonios</span>
            <span class="toolbar-pages">{{ currentPage + 1 }} / {{ totalPages }}</span>
          </div>

          <div class="carousel-controls">
            <button
              type="button"
              class="nav-btn"
              (click)="prevPage(true)"
              [attr.aria-label]="'Ver testimonios anteriores'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>

            <button
              type="button"
              class="nav-btn"
              (click)="nextPage(true)"
              [attr.aria-label]="'Ver más testimonios'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Carousel -->
        <div
          class="carousel-shell"
          (mouseenter)="pauseAutoPlay()"
          (mouseleave)="resumeAutoPlay()"
          (touchstart)="pauseAutoPlay()"
          (touchend)="resumeAutoPlay()"
        >
          <div
            class="carousel-track"
            [style.transform]="'translateX(-' + currentPage * 100 + '%)'"
          >
            @for (page of testimonialPages; track $index) {
              <div
                class="carousel-page"
                [style.--columns]="cardsPerView"
              >
                @for (t of page; track t.name + t.quote) {
                  <article class="testimonial-card">
                    <div class="card-top">
                      <div class="person-badge" [class.patient]="t.type === 'Paciente'">
                        <span class="status-dot"></span>
                        {{ t.type }}
                      </div>

                      <div class="stars" aria-hidden="true">
                        @for (s of [1,2,3,4,5]; track s) {
                          <svg class="star" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                          </svg>
                        }
                      </div>
                    </div>

                    <p class="quote-text">{{ t.quote }}</p>

                    @if (t.result) {
                      <div class="result-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <path d="M22 4L12 14.01l-3-3"/>
                        </svg>
                        {{ t.result }}
                      </div>
                    }

                    <div class="author-row">
                      <div class="author-avatar" [style.background]="t.avatarGradient">
                        <span class="author-initial">{{ t.name[0] }}</span>
                      </div>

                      <div class="author-info">
                        <span class="author-name">{{ t.name }}</span>
                        <span class="author-role">{{ t.role }}</span>
                      </div>
                    </div>
                  </article>
                }
              </div>
            }
          </div>
        </div>

        <!-- Dots -->
        <div class="carousel-dots" *ngIf="totalPages > 1">
          @for (page of testimonialPages; track $index) {
            <button
              type="button"
              class="dot"
              [class.active]="$index === currentPage"
              (click)="goToPage($index, true)"
              [attr.aria-label]="'Ir a la página ' + ($index + 1) + ' de testimonios'"
            ></button>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .testimonials-section {
      position: relative;
      overflow: hidden;
      padding: 6.5rem 0 7.5rem;
      background:
        radial-gradient(circle at top left, rgba(231, 92, 62, 0.06), transparent 28%),
        radial-gradient(circle at bottom right, rgba(239, 192, 72, 0.08), transparent 22%),
        linear-gradient(180deg, #fffaf7 0%, #fff 42%, #fcfcfb 100%);
    }

    .bg-orb {
      position: absolute;
      border-radius: 999px;
      filter: blur(60px);
      pointer-events: none;
      opacity: 0.45;
    }

    .orb-1 {
      top: 80px;
      left: -60px;
      width: 220px;
      height: 220px;
      background: rgba(231, 92, 62, 0.10);
    }

    .orb-2 {
      right: -40px;
      bottom: 100px;
      width: 260px;
      height: 260px;
      background: rgba(239, 192, 72, 0.14);
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    @media (min-width: 640px) {
      .content-wrapper {
        padding: 0 2rem;
      }
    }

    @media (min-width: 1024px) {
      .content-wrapper {
        padding: 0 3rem;
      }
    }

    .section-header {
      max-width: 760px;
      margin: 0 auto 2.5rem;
      text-align: center;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border: 1px solid rgba(231, 92, 62, 0.14);
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(10px);
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      color: #c95138;
      letter-spacing: 0.02em;
      margin-bottom: 1.2rem;
    }

    .eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #e75c3e;
      box-shadow: 0 0 0 6px rgba(231, 92, 62, 0.12);
      flex-shrink: 0;
    }

    .section-title {
      margin: 0 0 1rem;
      font-family: "kengoFont", system-ui, sans-serif;
      font-size: clamp(2.2rem, 5vw, 3.6rem);
      line-height: 1.03;
      letter-spacing: -0.035em;
      color: #1f2937;
    }

    .title-accent {
      color: #e75c3e;
    }

    .section-subtitle {
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.8;
      color: #6b7280;
    }

    .carousel-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.1rem;
    }

    .toolbar-info {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      min-width: 0;
    }

    .toolbar-kicker {
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #e75c3e;
    }

    .toolbar-pages {
      font-size: 0.95rem;
      font-weight: 700;
      color: #6b7280;
    }

    .carousel-controls {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-shrink: 0;
    }

    .nav-btn {
      width: 46px;
      height: 46px;
      border: 1px solid rgba(17, 24, 39, 0.08);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.92);
      color: #1f2937;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition:
        transform 0.25s ease,
        border-color 0.25s ease,
        box-shadow 0.25s ease,
        background 0.25s ease;
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.04);
    }

    .nav-btn:hover {
      transform: translateY(-2px);
      border-color: rgba(231, 92, 62, 0.18);
      box-shadow: 0 12px 30px rgba(231, 92, 62, 0.10);
      background: #fff;
    }

    .nav-btn svg {
      width: 18px;
      height: 18px;
    }

    .carousel-shell {
      overflow: hidden;
      border-radius: 28px;
    }

    .carousel-track {
      display: flex;
      will-change: transform;
      transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .carousel-page {
      min-width: 100%;
      display: grid;
      grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
      gap: 1.25rem;
      align-items: stretch;
    }

    .testimonial-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 100%;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(17, 24, 39, 0.06);
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.035);
      transition:
        transform 0.28s ease,
        box-shadow 0.28s ease,
        border-color 0.28s ease;
    }

    .testimonial-card:hover {
      transform: translateY(-4px);
      border-color: rgba(231, 92, 62, 0.16);
      box-shadow:
        0 18px 40px rgba(17, 24, 39, 0.06),
        0 8px 24px rgba(231, 92, 62, 0.08);
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .person-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 11px;
      border-radius: 999px;
      background: rgba(231, 92, 62, 0.08);
      color: #cf563b;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .person-badge.patient {
      background: rgba(79, 70, 229, 0.08);
      color: #4f46e5;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.85;
      flex-shrink: 0;
    }

    .stars {
      display: flex;
      gap: 3px;
      color: #efc048;
      flex-shrink: 0;
    }

    .star {
      width: 15px;
      height: 15px;
    }

    .quote-text {
      margin: 0;
      font-size: 15px;
      line-height: 1.78;
      color: #374151;
      letter-spacing: -0.01em;
      flex: 1;
    }

    .result-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.10);
      color: #159947;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.3;
    }

    .result-badge svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .author-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 1rem;
      margin-top: 0.1rem;
      border-top: 1px solid rgba(17, 24, 39, 0.07);
    }

    .author-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
    }

    .author-initial {
      font-size: 16px;
      font-weight: 800;
      color: #fff;
    }

    .author-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .author-name {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.01em;
    }

    .author-role {
      font-size: 12.5px;
      line-height: 1.45;
      color: #6b7280;
    }

    .carousel-dots {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      margin-top: 1.4rem;
    }

    .dot {
      width: 9px;
      height: 9px;
      border: none;
      border-radius: 999px;
      background: rgba(156, 163, 175, 0.45);
      cursor: pointer;
      transition: all 0.25s ease;
      padding: 0;
    }

    .dot.active {
      width: 28px;
      background: #e75c3e;
    }

    @media (max-width: 1023px) {
      .carousel-page {
        gap: 1rem;
      }
    }

    @media (max-width: 767px) {
      .testimonials-section {
        padding: 5rem 0 6rem;
      }

      .carousel-toolbar {
        margin-bottom: 1rem;
      }

      .toolbar-kicker {
        font-size: 0.75rem;
      }

      .toolbar-pages {
        font-size: 0.88rem;
      }

      .nav-btn {
        width: 42px;
        height: 42px;
        border-radius: 12px;
      }

      .testimonial-card {
        padding: 1.2rem;
        border-radius: 22px;
      }

      .quote-text {
        font-size: 14.5px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .carousel-track,
      .testimonial-card,
      .nav-btn,
      .dot {
        transition: none;
      }
    }
  `]
})
export class TestimonialsComponent implements OnInit, OnDestroy {
  currentPage = 0;
  cardsPerView = 3;
  testimonialPages: any[] = [];

  private autoPlayInterval: ReturnType<typeof setInterval> | null = null;

  testimonials = [
    {
      name: 'Marta R.',
      role: 'Paciente · Recuperación de hombro',
      type: 'Paciente',
      quote:
        'Yo soy de las que necesitan verlo todo claro. Tener los ejercicios en el móvil, con el vídeo y las repeticiones, me ayudó muchísimo. Antes salía de la consulta pensando “luego lo miro” y al final dudaba. Ahora no.',
      result: 'Más constancia entre sesiones',
      avatarGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    },
    {
      name: 'Javier Soto',
      role: 'Fisioterapeuta · Traumatología',
      type: 'Fisioterapeuta',
      quote:
        'Lo que más me gusta es que el paciente no depende de una hoja mal explicada o de una foto suelta. Le mando la rutina, la adapto en dos minutos y sé exactamente qué le he prescrito.',
      result: 'Menos tiempo explicando lo mismo',
      avatarGradient: 'linear-gradient(135deg, #e75c3e, #c94a2f)',
    },
    {
      name: 'Lucía P.',
      role: 'Paciente · Dolor lumbar',
      type: 'Paciente',
      quote:
        'En mi caso lo importante fue la tranquilidad. Si un ejercicio me generaba duda, podía revisar el vídeo o escribir directamente. Eso me quitó bastante inseguridad al empezar.',
      result: 'Más confianza al hacer ejercicios en casa',
      avatarGradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    },
    {
      name: 'Diego Moreno',
      role: 'Fisioterapeuta · Deportivo',
      type: 'Fisioterapeuta',
      quote:
        'La sensación es que el tratamiento sigue vivo entre cita y cita. Antes muchos pacientes llegaban diciendo que no recordaban bien el orden o las repeticiones. Eso ahora casi no pasa.',
      result: 'Mejor adherencia del paciente',
      avatarGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    },
    {
      name: 'Paula C.',
      role: 'Paciente · Esguince de tobillo',
      type: 'Paciente',
      quote:
        'Me vino muy bien porque soy bastante desastre con los papeles. Aquí tenía todo en un solo sitio y además podía ver lo que me tocaba esa semana sin estar rebuscando conversaciones.',
      result: 'Seguimiento más ordenado',
      avatarGradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    },
    {
      name: 'Elena Vidal',
      role: 'Fisioterapeuta · Rehabilitación y ejercicio terapéutico',
      type: 'Fisioterapeuta',
      quote:
        'Es una herramienta muy práctica para pacientes que necesitan continuidad. No es solo enviar ejercicios; también cambia mucho la comunicación. Todo queda más claro, más limpio y más profesional.',
      result: 'Mejor experiencia para el paciente',
      avatarGradient: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    },
    {
      name: 'Sergio M.',
      role: 'Paciente · Cervicalgia',
      type: 'Paciente',
      quote:
        'A mí me costaba coger hábito. El hecho de entrar, ver la rutina y hacerla sin tener que recordar qué me habían dicho hizo que fuera mucho más constante. Parece una tontería, pero se nota.',
      result: 'Más regularidad semana a semana',
      avatarGradient: 'linear-gradient(135deg, #64748b, #334155)',
    },
    {
      name: 'Irene López',
      role: 'Fisioterapeuta · ATM y dolor crónico',
      type: 'Fisioterapeuta',
      quote:
        'Tengo pacientes muy distintos entre sí y valoro poder personalizar lo que envío sin complicarme. La parte visual ayuda mucho: entienden mejor el ejercicio y luego preguntan menos cosas básicas.',
      result: 'Menos dudas repetidas por mensaje',
      avatarGradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    },
    {
      name: 'Raquel T.',
      role: 'Paciente · Postoperatorio de rodilla',
      type: 'Paciente',
      quote:
        'Después de la operación estaba bastante perdida y me daba miedo hacer algo que no tocaba. Tener las pautas ahí, bien explicadas, me ayudó a ir ganando seguridad cada semana.',
      result: 'Más seguridad durante la recuperación',
      avatarGradient: 'linear-gradient(135deg, #22c55e, #15803d)',
    },
    {
      name: 'Pablo Ferrer',
      role: 'Fisioterapeuta · Consulta privada',
      type: 'Fisioterapeuta',
      quote:
        'Lo uso sobre todo porque simplifica mucho el seguimiento. El paciente sale con la sensación de que tiene una guía clara y yo no tengo que improvisar envíos por WhatsApp ni notas por separado.',
      result: 'Seguimiento más profesionalizado',
      avatarGradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    },
    {
      name: 'Nuria G.',
      role: 'Paciente · Recuperación posparto',
      type: 'Paciente',
      quote:
        'En esta etapa voy con mil cosas en la cabeza, así que agradecí muchísimo tener instrucciones sencillas y directas. La app me lo puso fácil para no dejarlo pasar.',
      result: 'Más fácil mantener la rutina',
      avatarGradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    },
    {
      name: 'Adrián Peña',
      role: 'Fisioterapeuta · Columna y readaptación',
      type: 'Fisioterapeuta',
      quote:
        'He probado varias formas de mandar ejercicios y esta es la que mejor me ha funcionado para que el paciente realmente los haga. Cuando todo está claro y accesible, se nota enseguida en la continuidad.',
      result: 'Pacientes más implicados',
      avatarGradient: 'linear-gradient(135deg, #84cc16, #4d7c0f)',
    },
  ];

  ngOnInit(): void {
    this.updateLayout();
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.clearAutoPlay();
  }

  @HostListener('window:resize')
  onResize(): void {
    const previousCardsPerView = this.cardsPerView;
    this.updateCardsPerView();

    if (previousCardsPerView !== this.cardsPerView) {
      this.buildPages();
      this.currentPage = Math.min(this.currentPage, this.totalPages - 1);
    }
  }

  get totalPages(): number {
    return this.testimonialPages.length;
  }

  prevPage(userInteracted = false): void {
    if (!this.totalPages) return;
    this.currentPage =
      this.currentPage === 0 ? this.totalPages - 1 : this.currentPage - 1;

    if (userInteracted) {
      this.restartAutoPlay();
    }
  }

  nextPage(userInteracted = false): void {
    if (!this.totalPages) return;
    this.currentPage =
      this.currentPage === this.totalPages - 1 ? 0 : this.currentPage + 1;

    if (userInteracted) {
      this.restartAutoPlay();
    }
  }

  goToPage(index: number, userInteracted = false): void {
    this.currentPage = index;

    if (userInteracted) {
      this.restartAutoPlay();
    }
  }

  pauseAutoPlay(): void {
    this.clearAutoPlay();
  }

  resumeAutoPlay(): void {
    this.startAutoPlay();
  }

  private updateLayout(): void {
    this.updateCardsPerView();
    this.buildPages();
    this.currentPage = 0;
  }

  private updateCardsPerView(): void {
    if (window.innerWidth < 768) {
      this.cardsPerView = 1;
      return;
    }

    if (window.innerWidth < 1100) {
      this.cardsPerView = 2;
      return;
    }

    this.cardsPerView = 3;
  }

  private buildPages(): void {
    const pages: any[] = [];

    for (let i = 0; i < this.testimonials.length; i += this.cardsPerView) {
      pages.push(this.testimonials.slice(i, i + this.cardsPerView));
    }

    this.testimonialPages = pages;
  }

  private startAutoPlay(): void {
    if (this.autoPlayInterval || this.totalPages <= 1) return;

    this.autoPlayInterval = setInterval(() => {
      this.nextPage(false);
    }, 5000);
  }

  private clearAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  private restartAutoPlay(): void {
    this.clearAutoPlay();
    this.startAutoPlay();
  }
}