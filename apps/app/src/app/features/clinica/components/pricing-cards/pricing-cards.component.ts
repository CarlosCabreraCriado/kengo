import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

import {
  Ui2ButtonComponent,
  Ui2IconBadgeComponent,
  Ui2PillComponent,
} from '../../../../shared/ui-v2';

import type { PlanInfo, PlanVariante } from '@kengo/shared-models';

interface PlanView {
  nombre: string;
  overline: string;
  /** Precio de la variante activa/seleccionada (el grande de la card). */
  precioDestacadoEur: number;
  /** Chip discreto con la OTRA variante. */
  chipEtiqueta: string;
  chipPrecioEur: number;
  chipDetalle: string;
  rangoFisiosMax: number;
  destacado: boolean;
  features: string[];
}

const VIEW_OVERRIDES: Record<
  string,
  Pick<PlanView, 'overline' | 'destacado'> & { features: string[] }
> = {
  Lonely: {
    overline: 'Individual',
    destacado: false,
    features: ['1 fisioterapeuta', 'Catálogo de ejercicios', 'Soporte por email'],
  },
  Smart: {
    overline: 'Equipo pequeño',
    destacado: true,
    features: [
      'Hasta 4 fisioterapeutas',
      'Catálogo de ejercicios',
      'Soporte prioritario',
    ],
  },
  Medium: {
    overline: 'Equipo',
    destacado: false,
    features: [
      'Hasta 9 fisioterapeutas',
      'Catálogo de ejercicios',
      'Soporte prioritario',
    ],
  },
};

@Component({
  standalone: true,
  selector: 'app-pricing-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    Ui2ButtonComponent,
    Ui2IconBadgeComponent,
    Ui2PillComponent,
  ],
  templateUrl: './pricing-cards.component.html',
  styleUrls: ['./pricing-cards.component.css'],
  host: { class: 'block' },
})
export class PricingCardsComponent {
  readonly planes = input.required<PlanInfo[]>();
  readonly planActualNombre = input<string | null>(null);
  /** Variante con la que se renderizan precio y feature de pacientes. */
  readonly variante = input<PlanVariante>('base');
  readonly contactarVentas = output<void>();

  protected readonly views = computed<PlanView[]>(() => {
    const variante = this.variante();
    return this.planes().map((p) => {
      const override = VIEW_OVERRIDES[p.nombre] ?? {
        overline: p.nombre,
        destacado: false,
        features: [
          `Hasta ${p.rangoFisiosMax} fisioterapeuta${p.rangoFisiosMax === 1 ? '' : 's'}`,
          'Catálogo de ejercicios',
          'Soporte por email',
        ],
      };
      // La feature de pacientes depende de la variante: cap del plan en base,
      // sin límite en ilimitada. Se inserta tras la primera feature (equipo).
      const featurePacientes =
        variante === 'ilimitada'
          ? 'Pacientes ilimitados'
          : `Hasta ${p.limitePacientes} pacientes`;
      const features = [
        override.features[0] ?? '',
        featurePacientes,
        ...override.features.slice(1),
      ].filter(Boolean);
      // El precio grande sigue a la variante activa; el chip punteado muestra
      // siempre la otra, para que ambos precios sean visibles a la vez.
      const esIlimitada = variante === 'ilimitada';
      return {
        nombre: p.nombre,
        overline: override.overline,
        precioDestacadoEur: esIlimitada ? p.precioIlimitadoEur : p.precioBaseEur,
        chipEtiqueta: esIlimitada ? 'Base' : 'Ilimitado',
        chipPrecioEur: esIlimitada ? p.precioBaseEur : p.precioIlimitadoEur,
        chipDetalle: esIlimitada ? `hasta ${p.limitePacientes} pacientes` : '',
        rangoFisiosMax: p.rangoFisiosMax,
        destacado: override.destacado,
        features,
      };
    });
  });

  protected esPlanActual(view: PlanView): boolean {
    return this.planActualNombre() === view.nombre;
  }

  protected mostrarBadgePopular(view: PlanView): boolean {
    return view.destacado && !this.esPlanActual(view);
  }

  protected onContactarVentas(): void {
    this.contactarVentas.emit();
  }
}
