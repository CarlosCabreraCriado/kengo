import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';

import { assetUrl } from '../../../../core/utils/asset-url';
import { RutinasService } from '../../data-access/rutinas.service';
import { Rutina, RutinaCompleta } from '../../../../../types/global';
import {
  Ui2ButtonComponent,
  Ui2DialogActionsComponent,
  Ui2DialogContentComponent,
  Ui2DialogHeaderComponent,
  Ui2DialogHostComponent,
  Ui2EmptyStateComponent,
  Ui2ListRowComponent,
  Ui2PillComponent,
  Ui2ProgressBarComponent,
  Ui2SearchBoxComponent,
  Ui2SelectComponent,
  type Ui2SelectOption,
} from '../../../../shared/ui-v2';

type FiltroRutina = 'todas' | 'privadas' | 'clinica';

@Component({
  selector: 'app-selector-rutina',
  standalone: true,
  imports: [
    FormsModule,
    Ui2DialogHostComponent,
    Ui2DialogHeaderComponent,
    Ui2DialogContentComponent,
    Ui2DialogActionsComponent,
    Ui2ButtonComponent,
    Ui2EmptyStateComponent,
    Ui2ListRowComponent,
    Ui2PillComponent,
    Ui2ProgressBarComponent,
    Ui2SearchBoxComponent,
    Ui2SelectComponent,
  ],
  templateUrl: './selector-rutina.component.html',
  styleUrl: './selector-rutina.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorRutinaComponent implements OnInit {
  private dialogRef = inject(DialogRef<string>);
  rutinasService = inject(RutinasService);

  readonly busqueda = signal<string>('');
  readonly filtro = signal<FiltroRutina>('todas');

  readonly filtroOptions: Ui2SelectOption[] = [
    { value: 'todas', label: 'Todas' },
    { value: 'privadas', label: 'Mis rutinas' },
    { value: 'clinica', label: 'De la clínica' },
  ];

  readonly selectedId = signal<string | null>(null);
  readonly selectedRutina = signal<Rutina | null>(null);
  readonly isLoadingPreview = signal(false);
  readonly previewEjercicios = signal<RutinaCompleta['ejercicios']>([]);

  readonly rutinas = computed(() => this.rutinasService.rutinas());

  ngOnInit(): void {
    this.rutinasService.reload();
  }

  onBusquedaChange(value: string): void {
    this.busqueda.set(value);
    this.rutinasService.setBusqueda(value);
  }

  onFiltroChange(value: FiltroRutina): void {
    this.filtro.set(value);
    this.rutinasService.setFiltroVisibilidad(value);
  }

  async selectRutina(rutina: Rutina): Promise<void> {
    this.selectedId.set(rutina.id);
    this.selectedRutina.set(rutina);

    this.isLoadingPreview.set(true);
    try {
      const completa = await this.rutinasService.getRutinaById(rutina.id);
      if (completa) {
        this.previewEjercicios.set(completa.ejercicios);
      }
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  confirmar(): void {
    const id = this.selectedId();
    if (id) {
      this.dialogRef.close(id);
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  thumbUrl(id: string | null | undefined): string {
    if (!id) return '';
    return assetUrl(id, { width: 80, height: 80, fit: 'cover', format: 'webp' });
  }
}
