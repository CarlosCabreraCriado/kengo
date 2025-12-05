import {
  Component,
  computed,
  signal,
  inject,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
  Signal,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from '../services/app.service';
import { ActividadHoyService, BadgeType } from '../services/actividad-hoy.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DialogoComponent } from '../dialogos/dialogos.component';

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
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss',
})
export class InicioComponent implements OnDestroy {
  private appService = inject(AppService);
  private actividadHoyService = inject(ActividadHoyService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  carouselRef = viewChild<ElementRef<HTMLDivElement>>('carousel');

  userRole = this.appService.rolUsuario;

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
    },
    {
      id: 'ejercicios',
      title: 'Ejercicios',
      subtitle: 'Catálogo de ejercicios',
      image: 'assets/portadas/ejercicios.webp',
      route: '/ejercicios',
      roles: ['fisio'],
    },
    {
      id: 'pacientes',
      title: 'Mis Pacientes',
      subtitle: 'Gestiona tus pacientes',
      image: 'assets/portadas/clientes.webp',
      route: '/mis-pacientes',
      roles: ['fisio'],
    },
    {
      id: 'clinica',
      title: 'Mi Clínica',
      subtitle: 'Administra tu centro',
      image: 'assets/portadas/clinica.webp',
      route: '/mi-clinica',
      roles: ['fisio', 'paciente'],
    },
    {
      id: 'rutinas',
      title: 'Rutinas',
      subtitle: 'Planes de tratamiento',
      image: 'assets/portadas/rutina-horizontal.png',
      route: '/planes/nuevo',
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
        const scrollLeft = carousel.scrollLeft;
        const cardWidth = carousel.offsetWidth * 0.9;
        const gap = 16;
        const index = Math.round(scrollLeft / (cardWidth + gap));
        this.currentIndex.set(Math.max(0, Math.min(index, this.cards().length - 1)));
      }, 50);
    });
  }

  scrollToCard(index: number): void {
    const carousel = this.carouselRef()?.nativeElement;
    if (!carousel) return;

    const cardWidth = carousel.offsetWidth * 0.9;
    const gap = 16;
    const scrollPosition = index * (cardWidth + gap);

    carousel.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });

    this.currentIndex.set(index);
  }

  navigateToCard(card: CardOption): void {
    this.router.navigate([card.route]);
  }

  confirmarLogout(): void {
    const dialogRef = this.dialog.open(DialogoComponent, {
      data: {
        tipo: 'confirmacion',
        titulo: '¿Cerrar sesión?',
        mensaje: '¿Estás seguro de que quieres cerrar tu sesión?',
        botonConfirmar: 'Cerrar sesión',
        botonCancelar: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.logout();
      }
    });
  }

  private logout(): void {
    this.router.navigate(['/login']);
  }
}
