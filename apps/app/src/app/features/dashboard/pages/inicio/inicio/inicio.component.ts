import {
  Component,
  computed,
  signal,
  inject,
  ElementRef,
  HostListener,
  viewChild,
  OnDestroy,
  Signal,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { environment as env } from '../../../../../../environments/environment';
import { SessionService } from '../../../../../core/auth/services/session.service';
import { AuthService } from '../../../../../core/auth/services/auth.service';
import { ThemeService } from '../../../../../core/services/theme.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';
import {
  ActividadHoyService,
  BadgeType,
} from '../../../../actividad/data-access/actividad-hoy.service';
import { KENGO_BREAKPOINTS } from '../../../../../shared';
import type { NotificacionApp } from '../../../../../../types/global';

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
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private actividadHoyService = inject(ActividadHoyService);
  public notificacionesService = inject(NotificacionesService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private elementRef = inject(ElementRef);

  // Signal de logo desde ThemeService
  logoUrl = this.themeService.logoUrl;

  carouselRef = viewChild<ElementRef<HTMLDivElement>>('carousel');

  // Estado del menú de usuario
  menuAbierto = signal(false);

  // Estado del panel de notificaciones
  notificacionesAbiertas = signal(false);
  isFisio = computed(() => this.sessionService.rolUsuario() === 'fisio');

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.notificacionesAbiertas()) return;
    const container = this.elementRef.nativeElement.querySelector('.notificaciones-container');
    if (!container?.contains(event.target as Node)) {
      this.cerrarNotificaciones();
    }
  }

  // Detectar si es móvil (< 768px) - alineado con breakpoint de navegación
  isMovil = toSignal(
    this.breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((result) => result.matches)),
    { initialValue: true },
  );

  userRole = this.sessionService.rolUsuario;
  userName = computed(
    () => this.sessionService.usuario()?.first_name ?? 'Usuario',
  );
  userAvatar = computed(
    () => this.sessionService.usuario()?.avatar_url ?? null,
  );

  allCards: CardOption[] = [
    {
      id: 'mi-actividad',
      title: 'Mi actividad',
      subtitle: 'Tu progreso diario',
      image: 'assets/portadas/opcion-ejercicios.webp',
      route: '/actividad-personal/hoy',
      roles: ['fisio', 'paciente'],
    },
    {
      id: 'actividad-personal',
      title: 'Actividad personal',
      subtitle: 'Tu plan de hoy',
      image: 'assets/portadas/opcion-ejercicios.webp',
      route: '/actividad-personal',
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
      title: 'Galería',
      subtitle: 'Ejercicios y plantillas',
      image: 'assets/portadas/opcion-galeria.webp',
      route: '/galeria',
      roles: ['fisio'],
    },
    {
      id: 'pacientes',
      title: 'Mis Pacientes',
      subtitle: 'Gestiona tus pacientes',
      image: 'assets/portadas/opcion-pacientes.webp',
      route: '/mis-pacientes',
      roles: ['fisio'],
    },
    {
      id: 'clinica',
      title: 'Mi Clínica',
      subtitle: 'Administra tu centro',
      image: 'assets/portadas/opcion-clinica.webp',
      route: '/mi-clinica',
      roles: ['fisio', 'paciente'],
    },
    {
      id: 'rutinas',
      title: 'Rutinas',
      subtitle: 'Plantillas de ejercicios',
      image: 'assets/portadas/opcion-rutina.webp',
      route: '/galeria/rutinas',
      roles: ['fisio'],
    },
    /*
    {
      id: 'mi-plan',
      title: 'Mi Plan',
      subtitle: 'Tu plan de recuperación',
      image: 'assets/portadas/camilla.PNG',
      route: '/mi-plan',
      roles: ['fisio', 'paciente'],
    },
    {
      id: 'progreso',
      title: 'Mi Progreso',
      subtitle: 'Seguimiento de evolución',
      image: 'assets/portadas/progreso-horizontal.png',
      route: '/progreso',
      roles: ['fisio', 'paciente'],
    },
    */
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

  // Métodos del menú de usuario
  toggleMenu(): void {
    this.cerrarNotificaciones();
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  // Métodos de notificaciones
  toggleNotificaciones(): void {
    this.cerrarMenu();
    this.notificacionesAbiertas.update((v) => !v);
  }

  cerrarNotificaciones(): void {
    this.notificacionesAbiertas.set(false);
  }

  marcarRevisada(n: NotificacionApp): void {
    this.notificacionesService.marcarRevisada(n);
  }

  marcarTodasRevisadas(): void {
    this.notificacionesService.marcarTodasRevisadas();
  }

  irANotificacion(n: NotificacionApp): void {
    this.cerrarNotificaciones();
    if (!n.leida) {
      this.notificacionesService.marcarRevisada(n);
    }
    const currentUrl = this.router.url.split('?')[0];
    const destino = n.ruta_destino;
    const mismoContexto =
      currentUrl.startsWith('/mis-pacientes/') && destino.startsWith('/mis-pacientes/');

    if (mismoContexto && currentUrl !== destino) {
      this.router.navigateByUrl('/mis-pacientes', { skipLocationChange: true }).then(() => {
        this.router.navigate([destino]);
      });
    } else {
      this.router.navigate([destino]);
    }
  }

  avatarUrlEmisor(avatar: string | null): string | null {
    return avatar
      ? `${env.DIRECTUS_URL}/assets/${avatar}?fit=cover&width=64&height=64&quality=80`
      : null;
  }

  formatearFechaNotificacion(fecha: string): string {
    const d = new Date(fecha);
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const ayer = new Date(hoy.getTime() - 86400000);

    if (d >= hoy) return 'Hoy';
    if (d >= ayer) return 'Ayer';

    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  irAPerfil(): void {
    this.cerrarMenu();
    this.router.navigate(['/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    this.cerrarMenu();
    await this.authService.logout();
  }

  onLogoError(): void {
    this.themeService.resetLogo();
  }
}
