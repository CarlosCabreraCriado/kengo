import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  Signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

import { EjerciciosService } from '../../data-access/ejercicios.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { Ejercicio } from '../../../../../types/global';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { useResponsive } from '../../../../shared';
import {
  Ui2ButtonComponent,
  Ui2EmptyStateComponent,
  Ui2PillComponent,
  Ui2SearchBoxComponent,
  Ui2SectionComponent,
  Ui2SegmentedComponent,
  Ui2SegmentedOption,
  Ui2SpinnerComponent,
} from '../../../../shared/ui-v2';

type Vista = 'vineta' | 'lista';

@Component({
  selector: 'app-ejercicios-list',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    NgOptimizedImage,
    SafeHtmlPipe,
    Ui2ButtonComponent,
    Ui2EmptyStateComponent,
    Ui2PillComponent,
    Ui2SearchBoxComponent,
    Ui2SectionComponent,
    Ui2SegmentedComponent,
    Ui2SpinnerComponent,
  ],
  templateUrl: './ejercicios-list.component.html',
  styleUrl: './ejercicios-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EjerciciosListComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private elementRef = inject(ElementRef);
  private router = inject(Router);
  public ejerciciosService = inject(EjerciciosService);
  private pageLoader = inject(PageLoaderService);
  private readonly PAGE_LOADER_KEY = 'ejercicios-list';

  /** Datos críticos: lista de ejercicios resuelta. */
  readonly pageReady = computed(
    () => !this.ejerciciosService.listaEjerciciosRes.isLoading(),
  );

  public vista = signal<Vista>('lista');

  readonly vistaOptions: Ui2SegmentedOption[] = [
    { id: 'vineta', label: 'Cuadrícula', icon: 'grid_view' },
    { id: 'lista', label: 'Lista', icon: 'view_list' },
  ];

  readonly catalogoTabs: Ui2SegmentedOption[] = [
    { id: 'ejercicios', label: 'Ejercicios' },
    { id: 'rutinas', label: 'Rutinas' },
  ];

  // Set para rastrear qué imágenes ya cargaron
  public imagenesLoaded = signal<Set<string>>(new Set());

  onImageLoad(idEjercicio: string): void {
    this.imagenesLoaded.update((set) => {
      const newSet = new Set(set);
      newSet.add(idEjercicio);
      return newSet;
    });
  }

  isImageLoaded(idEjercicio: string): boolean {
    return this.imagenesLoaded().has(idEjercicio);
  }

  isMovil = useResponsive().esMobile;

  // Estado del menú de categorías
  menuAbierto = signal(false);

  // Cerrar menú al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const menuContainer = this.elementRef.nativeElement.querySelector(
      '.el-cat-dropdown',
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

  public readonly ejercicios = computed<Ejercicio[]>(
    () => this.ejerciciosService.listaEjerciciosRes.value().data,
  );

  public categoriasSeleccionadas = computed(() => {
    return this.ejerciciosService.idsCategoriasSeleccionadas();
  });

  public total = this.ejerciciosService.total;
  public totalPages = this.ejerciciosService.totalPages;
  public page = this.ejerciciosService.page;
  public categorias = this.ejerciciosService.categoriasRes.value;
  public hasActiveFilters = this.ejerciciosService.hasActiveFilters;

  // ---- Formulario de filtros ----
  formularioFiltros = this.fb.group({
    busqueda: [this.ejerciciosService.busqueda()],
    sort: [this.ejerciciosService.sort()],
    pageSize: [this.ejerciciosService.pageSize()],
    categories: [this.ejerciciosService.idsCategoriasSeleccionadas()],
  });

  constructor() {
    // Búsqueda con debounce (mejor UX)
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
        if (v == 'nombre' || v == '-nombre') {
          this.ejerciciosService.setSort(v);
        }
      });

    // Tamaño de página
    this.formularioFiltros.controls.pageSize
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => this.ejerciciosService.setPageSize(Number(v)));

    // Categorías
    this.formularioFiltros.controls.categories
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => {
        this.ejerciciosService.idsCategoriasSeleccionadas.set(v ?? []);
      });
  }

  ngOnInit() {
    if (this.isMovil()) this.vista.set('lista');

    // Cargar favoritos del usuario
    this.ejerciciosService.cargarFavoritos();
    this.pageLoader.register(this.PAGE_LOADER_KEY, this.pageReady);
  }

  ngOnDestroy() {
    this.pageLoader.unregister(this.PAGE_LOADER_KEY);
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

  setVista(value: string) {
    if (value === 'vineta' || value === 'lista') {
      this.vista.set(value);
    }
  }

  onCatalogoTabChange(value: string) {
    if (value === 'rutinas') {
      this.router.navigate(['/rutinas']);
    }
  }

  onBuscar(term: string) {
    this.formularioFiltros.controls.busqueda.setValue(term ?? '');
  }

  // Opcional: helper usado en [selected]
  isCatSelected(
    id: string,
    categoriaSignal: Signal<string[]>,
  ): boolean {
    const arr = categoriaSignal() || [];
    return Array.isArray(arr) && arr.includes(id);
  }

  onCategoriaChange(id: string, checked: boolean) {
    const current = this.formularioFiltros.controls.categories.value ?? [];
    const updated = checked
      ? [...current, id]
      : current.filter((c) => c !== id);

    this.formularioFiltros.controls.categories.setValue(updated);
  }

  toggleCategoria(id: string) {
    this.ejerciciosService.toggleCategoria(id);
  }

  limpiarCategorias() {
    this.formularioFiltros.patchValue(
      { categories: [] },
      { emitEvent: false },
    );

    this.ejerciciosService.limpiarCategorias();
  }

  borrarFiltros() {
    this.formularioFiltros.patchValue(
      { busqueda: '', categories: [] },
      { emitEvent: true },
    );
    this.ejerciciosService.clearFilters();
  }

  // Paginación
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

  toggleFavorito(event: Event, idEjercicio: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.ejerciciosService.toggleFavorito(idEjercicio);
  }

  toggleSoloFavoritos(): void {
    this.ejerciciosService.toggleSoloFavoritos();
  }

  esFavorito(idEjercicio: string): boolean {
    return this.ejerciciosService.esFavorito(idEjercicio);
  }

  favoritoEnProceso(idEjercicio: string): boolean {
    return this.ejerciciosService.favoritoEnProceso() === idEjercicio;
  }
}
