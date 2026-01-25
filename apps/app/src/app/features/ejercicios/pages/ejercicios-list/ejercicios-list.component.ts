import {
  Component,
  computed,
  inject,
  signal,
  Signal,
  OnInit,
  ElementRef,
  HostListener,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { EjerciciosService } from '../../data-access/ejercicios.service';
import { Ejercicio } from '../../../../../types/global';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { KENGO_BREAKPOINTS } from '../../../../shared';

@Component({
  selector: 'app-ejercicios-list',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, SafeHtmlPipe],
  templateUrl: './ejercicios-list.component.html',
  styleUrl: './ejercicios-list.component.css',
  host: {
    class: 'flex flex-col flex-1 min-h-0 w-full overflow-hidden',
  },
})
export class EjerciciosListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private elementRef = inject(ElementRef);
  public ejerciciosService = inject(EjerciciosService);
  public vista = signal<'vineta' | 'lista'>('lista');
  private breakpointObserverService = inject(BreakpointObserver);

  // Detectar si estamos en desktop (>= 1024px)
  isDesktop = toSignal(
    this.breakpointObserverService
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Estado del menú de categorías
  menuAbierto = signal(false);

  // Cerrar menú al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const menuContainer = this.elementRef.nativeElement.querySelector(
      '.categories-dropdown-container',
    );
    if (menuContainer && !menuContainer.contains(target)) {
      this.menuAbierto.set(false);
    }
  }

  toggleMenu() {
    this.menuAbierto.update((v) => !v);
  }

  closeMenu() {
    this.menuAbierto.set(false);
  }

  filtrosAbiertos = signal(false);
  toggleFiltros() {
    this.filtrosAbiertos.update((v) => !v);
  }

  public readonly ejercicios = computed<Ejercicio[]>(
    () => this.ejerciciosService.listaEjerciciosRes.value().data,
  );

  public categoriasSeleccionadas = computed(() => {
    return this.ejerciciosService.idsCategoriasSeleccionadas();
  });

  // ---- Formulario de filtros ----
  formularioFiltros = this.fb.group({
    busqueda: [this.ejerciciosService.busqueda()],
    sort: [this.ejerciciosService.sort()],
    pageSize: [this.ejerciciosService.pageSize()],
    categories: [this.ejerciciosService.idsCategoriasSeleccionadas()],
  });

  constructor() {
    // Busqueda con debounce (mejor UX)
    this.formularioFiltros.controls.busqueda
      .valueChanges!.pipe(
        map((v) => (v ?? '').trim()),
        distinctUntilChanged(),
        debounceTime(500),
        takeUntilDestroyed(),
      )
      .subscribe((v) => this.ejerciciosService.setBusqueda(v));

    // Orden
    this.formularioFiltros.controls.sort
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => {
        if (v == 'nombre_ejercicio' || v == '-nombre_ejercicio') {
          this.ejerciciosService.setSort(v);
        }
      });

    // Tamano de pagina
    this.formularioFiltros.controls.pageSize
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => this.ejerciciosService.setPageSize(Number(v)));

    // Categorias
    this.formularioFiltros.controls.categories
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => {
        this.ejerciciosService.idsCategoriasSeleccionadas.set(v ?? []);
      });
  }

  ngOnInit() {
    this.breakpointObserverService
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        if (result.matches) this.vista.set('lista');
      });

    // Cargar favoritos del usuario
    this.ejerciciosService.cargarFavoritos();
  }

  getAssetUrl(id: number | string) {
    return this.ejerciciosService.getAssetUrl(String(id));
  }

  get loading() {
    return this.ejerciciosService.listaEjerciciosRes.isLoading();
  }

  get error() {
    return this.ejerciciosService.listaEjerciciosRes.error();
  }

  // Opcional: helper usado en [selected]
  isCatSelected(
    id_categoria: number,
    categoriaSignal: Signal<(number | string)[]>,
  ): boolean {
    const arr = categoriaSignal() || [];
    return Array.isArray(arr) && arr.includes(id_categoria);
  }

  // Toggle categoria individual (para checkboxes nativos)
  onCategoriaChange(id: number, checked: boolean) {
    const current = this.formularioFiltros.controls.categories.value ?? [];
    let updated: (number | string)[];

    if (checked) {
      updated = [...current, id];
    } else {
      updated = current.filter((c) => c !== id);
    }

    this.formularioFiltros.controls.categories.setValue(updated);
  }

  toggleCategoria(id: string | number) {
    this.ejerciciosService.toggleCategoria(id);
  }

  limpiarCategorias() {
    this.formularioFiltros.patchValue(
      {
        categories: [],
      },
      { emitEvent: false },
    );

    this.ejerciciosService.limpiarCategorias();
  }

  borrarFiltros() {
    this.formularioFiltros.patchValue(
      {
        busqueda: '',
        categories: [],
      },
      { emitEvent: true },
    );
    this.ejerciciosService.clearFilters();
  }

  // Paginacion
  paginaAnterior() {
    this.ejerciciosService.goToPage(this.ejerciciosService.page() - 1);
  }
  siguientePagina() {
    this.ejerciciosService.goToPage(this.ejerciciosService.page() + 1);
  }

  // Recargas manuales
  reloadCategorias() {
    this.ejerciciosService.reloadCategorias();
  }
  reloadEjercicios() {
    this.ejerciciosService.reloadEjercicios();
  }

  // ========= Favoritos =========
  soloFavoritos = computed(() => this.ejerciciosService.soloFavoritos());

  toggleFavorito(event: Event, idEjercicio: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.ejerciciosService.toggleFavorito(idEjercicio);
  }

  toggleSoloFavoritos(): void {
    this.ejerciciosService.toggleSoloFavoritos();
  }

  esFavorito(idEjercicio: number): boolean {
    return this.ejerciciosService.esFavorito(idEjercicio);
  }

  favoritoEnProceso(idEjercicio: number): boolean {
    return this.ejerciciosService.favoritoEnProceso() === idEjercicio;
  }
}
