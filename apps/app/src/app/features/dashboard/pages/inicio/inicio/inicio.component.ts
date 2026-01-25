import {
  Component,
  computed,
  signal,
  inject,
  ElementRef,
  viewChild,
  OnDestroy,
  Signal,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { SessionService } from '../../../../../core/auth/services/session.service';
import {
  ActividadHoyService,
  BadgeType,
} from '../../../../actividad/data-access/actividad-hoy.service';
import { KENGO_BREAKPOINTS } from '../../../../../shared';

interface CardOption {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  route: string;
  roles: ('fisio' | 'paciente')[];
  // Propiedades dinámicas opcionales
  dynamicSubtitle?: Signal<string>;
  badgeCount?: Signal<number>;
  badgeType?: Signal<BadgeType>;
  progreso?: Signal<{ completados: number; total: number }>;
  siguienteEjercicio?: Signal<string | null>;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent implements OnDestroy {
  private sessionService = inject(SessionService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  carouselRef = viewChild<ElementRef<HTMLDivElement>>('carousel');

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  userRole = this.sessionService.rolUsuario;
  userName = computed(() => this.sessionService.usuario()?.first_name ?? 'Usuario');
  userAvatar = computed(() => this.sessionService.usuario()?.avatar_url ?? null);

  allCards: CardOption[] = [
    {
      id: 'actividad-diaria',
      title: 'Actividad diaria',
      subtitle: 'Tu plan de hoy',
      image: 'assets/portadas/camilla.PNG',
      route: '/actividad-diaria',
      roles: ['fisio', 'paciente'],
      // Propiedades dinámicas
      dynamicSubtitle: this.actividadHoyService.subtituloDinamico,
      badgeCount: this.actividadHoyService.badgeCount,
      badgeType: this.actividadHoyService.badgeType,
      progreso: this.actividadHoyService.progresoTotal,
      siguienteEjercicio: this.actividadHoyService.primerEjercicioPendiente,
    },
    {
      id: 'ejercicios',
      title: 'Ejercicios',
      subtitle: 'Catálogo de ejercicios',
      image: 'assets/portadas/catalogo-ejercicios.png',
      route: '/ejercicios',
      roles: ['fisio'],
    },
    {
      id: 'pacientes',
      title: 'Mis Pacientes',
      subtitle: 'Gestiona tus pacientes',
      image: 'assets/portadas/pacientes.png',
      route: '/mis-pacientes',
      roles: ['fisio'],
    },
    {
      id: 'clinica',
      title: 'Mi Clínica',
      subtitle: 'Administra tu centro',
      image: 'assets/portadas/clinica.png',
      route: '/mi-clinica',
      roles: ['fisio', 'paciente'],
    },
    {
      id: 'rutinas',
      title: 'Rutinas',
      subtitle: 'Planes de tratamiento',
      image: 'assets/portadas/rutina.png',
      route: '/planes',
      roles: ['fisio'],
    },
    {
      id: 'mi-plan',
      title: 'Mi Plan',
      subtitle: 'Tu plan de recuperación',
      image: 'assets/portadas/camilla.PNG',
      route: '/mi-plan',
      roles: ['paciente'],
    },
    {
      id: 'progreso',
      title: 'Mi Progreso',
      subtitle: 'Seguimiento de evolución',
      image: 'assets/portadas/progreso-horizontal.png',
      route: '/progreso',
      roles: ['paciente'],
    },
  ];

  cards = computed(() => {
    const role = this.userRole();
    return this.allCards.filter((card) => card.roles.includes(role));
  });

  currentIndex = signal(0);

  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private scrollListenerConfigured = false;

  constructor() {
    // Effect que configura el scroll listener cuando el carousel está disponible
    effect(() => {
      const carouselEl = this.carouselRef();
      if (carouselEl && !this.scrollListenerConfigured) {
        this.setupScrollListener();
      }
    });
  }

  // Métodos helper para el template
  getCardSubtitle(card: CardOption): string {
    return card.dynamicSubtitle ? card.dynamicSubtitle() : card.subtitle;
  }

  getCardBadgeCount(card: CardOption): number {
    return card.badgeCount ? card.badgeCount() : 0;
  }

  getCardBadgeType(card: CardOption): BadgeType {
    return card.badgeType ? card.badgeType() : null;
  }

  getCardProgreso(
    card: CardOption,
  ): { completados: number; total: number } | null {
    return card.progreso ? card.progreso() : null;
  }

  getCardSiguienteEjercicio(card: CardOption): string | null {
    return card.siguienteEjercicio ? card.siguienteEjercicio() : null;
  }

  ngOnDestroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  private setupScrollListener(): void {
    const carousel = this.carouselRef()?.nativeElement;
    if (!carousel || this.scrollListenerConfigured) return;

    this.scrollListenerConfigured = true;

    carousel.addEventListener('scroll', () => {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }

      this.scrollTimeout = setTimeout(() => {
        // Buscar qué card está más cerca del centro del viewport
        const cards = carousel.querySelectorAll('.card');
        const carouselRect = carousel.getBoundingClientRect();
        const carouselCenter = carouselRect.left + carouselRect.width / 2;

        let closestIndex = 0;
        let closestDistance = Infinity;

        cards.forEach((card: Element, index: number) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(carouselCenter - cardCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        this.currentIndex.set(closestIndex);
      }, 50);
    });
  }

  scrollToCard(index: number): void {
    const carousel = this.carouselRef()?.nativeElement;
    if (!carousel) return;

    const cards = carousel.querySelectorAll('.card');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;

      // Calcular el scroll necesario para centrar la card
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const carouselVisibleCenter = carousel.offsetWidth / 2;
      const scrollPosition = cardCenter - carouselVisibleCenter;

      carousel.scrollTo({
        left: scrollPosition,
        behavior: 'smooth',
      });
    }

    this.currentIndex.set(index);
  }

  navigateToCard(card: CardOption): void {
    this.router.navigate([card.route]);
  }

}
