import {
  Component,
  computed,
  signal,
  inject,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from '../services/app.service';

interface CardOption {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  route: string;
  roles: ('fisio' | 'paciente')[];
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss',
})
export class InicioComponent implements OnDestroy {
  private appService = inject(AppService);
  private router = inject(Router);

  carouselRef = viewChild<ElementRef<HTMLDivElement>>('carousel');

  userRole = this.appService.rolUsuario;

  allCards: CardOption[] = [
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

  constructor() {
    afterNextRender(() => {
      this.setupScrollListener();
    });
  }

  ngOnDestroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  private setupScrollListener(): void {
    const carousel = this.carouselRef()?.nativeElement;
    if (!carousel) return;

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
}
