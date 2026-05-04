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

import type { PlanInfo } from '@kengo/shared-models';

interface PlanView {
  nombre: string;
  overline: string;
  precioMensualEur: number;
  rangoFisiosMax: number;
  destacado: boolean;
  features: string[];
}

const VIEW_OVERRIDES: Record<string, Pick<PlanView, 'overline' | 'destacado' | 'features'>> = {
  '1 Fisio': {
    overline: 'Individual',
    destacado: false,
    features: [
      '1 fisioterapeuta',
      'Pacientes ilimitados',
      'Catálogo de ejercicios',
      'Soporte por email',
    ],
  },
  '2-4 Fisios': {
    overline: 'Equipo pequeño',
    destacado: true,
    features: [
      'Hasta 4 fisioterapeutas',
      'Pacientes ilimitados',
      'Catálogo de ejercicios',
      'Soporte prioritario',
    ],
  },
  '5-10 Fisios': {
    overline: 'Equipo',
    destacado: false,
    features: [
      'Hasta 10 fisioterapeutas',
      'Pacientes ilimitados',
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
  readonly contactarVentas = output<void>();

  protected readonly views = computed<PlanView[]>(() => {
    return this.planes().map((p) => {
      const override = VIEW_OVERRIDES[p.nombre] ?? {
        overline: p.nombre,
        destacado: false,
        features: [
          `Hasta ${p.rangoFisiosMax} fisioterapeuta${p.rangoFisiosMax === 1 ? '' : 's'}`,
          'Pacientes ilimitados',
          'Catálogo de ejercicios',
          'Soporte por email',
        ],
      };
      return {
        nombre: p.nombre,
        overline: override.overline,
        precioMensualEur: p.precioMensualEur,
        rangoFisiosMax: p.rangoFisiosMax,
        destacado: override.destacado,
        features: override.features,
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
