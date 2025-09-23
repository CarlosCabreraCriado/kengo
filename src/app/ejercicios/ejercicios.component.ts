import {
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
  Signal,
  ViewChild,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

import { EjerciciosService } from '../services/ejercicios.service';
import { Ejercicio } from '../../types/global';

import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

//Angular Mateiral:
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatListModule } from '@angular/material/list';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-ejercicios',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatIconModule,
    MatExpansionModule,
    MatMenuModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './ejercicios.component.html',
  styleUrl: './ejercicios.component.css',
})
export class EjerciciosComponent implements OnInit {
  private fb = inject(FormBuilder);
  public ejerciciosService = inject(EjerciciosService);
  public vista = signal<'viñeta' | 'lista'>('viñeta');

  @ViewChild(MatMenuTrigger) menuFiltros!: MatMenuTrigger;

  closeMenu() {
    this.menuFiltros.closeMenu();
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

  constructor(private breakpointObserver: BreakpointObserver) {
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
        if (v == 'nombre_ejercicio' || v == '-nombre_ejercicio') {
          this.ejerciciosService.setSort(v);
        }
      });

    // Tamaño de página
    this.formularioFiltros.controls.pageSize
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => this.ejerciciosService.setPageSize(Number(v)));

    // Tamaño de página
    this.formularioFiltros.controls.categories
      .valueChanges!.pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((v) => {
        this.ejerciciosService.idsCategoriasSeleccionadas.set(v ?? []);
      });
  }

  ngOnInit() {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        if (result.matches) this.vista.set('lista');
      });
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

  // ---- Helpers de UI (manejados por el form) ----
  /*
  isCatSelected(id: string | number) {
    return (this.formularioFiltros.controls.categories.value ?? []).includes(
      id,
    );
  }
  */

  // Opcional: helper usado en [selected]
  isCatSelected(
    id_categoria: number,
    categoriaSignal: Signal<(number | string)[]>,
  ): boolean {
    const arr = categoriaSignal() || [];
    return Array.isArray(arr) && arr.includes(id_categoria);
  }

  toggleCategoria(id: string | number) {
    this.ejerciciosService.toggleCategoria(id); // actualiza el service (y resetea a página 1)
  }

  limpiarCategorias() {
    this.formularioFiltros.patchValue(
      {
        categories: [],
      },
      { emitEvent: false },
    );

    this.ejerciciosService.limpiarCategorias(); // actualiza el service (y resetea a página 1)
  }

  borrarFiltros() {
    // Resetea formulario y service
    this.formularioFiltros.patchValue(
      {
        busqueda: '',
        categories: [],
        // si quieres resetear orden/pageSize, descomenta:
        // sort: 'nombre_ejercicio',
        // pageSize: 12,
      },
      { emitEvent: true },
    );
    this.ejerciciosService.clearFilters();
  }

  // Paginación (no forma parte del form, pero actualiza señal y resource)
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

  //reload() { this.ejerciciosService.reloadExercises(); }
}
