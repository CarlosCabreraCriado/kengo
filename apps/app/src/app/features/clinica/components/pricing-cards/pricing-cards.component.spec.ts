import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PricingCardsComponent } from './pricing-cards.component';

import type { PlanInfo } from '@kengo/shared-models';

const PLANES: PlanInfo[] = [
  {
    nombre: 'Lonely',
    precioBaseEur: 89,
    precioIlimitadoEur: 109,
    limitePacientes: 150,
    rangoFisiosMin: 1,
    rangoFisiosMax: 1,
  },
  {
    nombre: 'Smart',
    precioBaseEur: 249,
    precioIlimitadoEur: 279,
    limitePacientes: 300,
    rangoFisiosMin: 2,
    rangoFisiosMax: 4,
  },
  {
    nombre: 'Medium',
    precioBaseEur: 449,
    precioIlimitadoEur: 489,
    limitePacientes: 500,
    rangoFisiosMin: 5,
    rangoFisiosMax: 9,
  },
];

describe('PricingCardsComponent', () => {
  let fixture: ComponentFixture<PricingCardsComponent>;

  /**
   * Texto legible de cada elemento que matchea: une los spans hijos con un
   * espacio (textContent los concatenaría pegados) y descarta las ligaduras
   * de Material Symbols (iconos como "check").
   */
  function textos(selector: string): string[] {
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll(selector)).map((el) => {
      if (el.children.length === 0) return (el.textContent ?? '').trim();
      return Array.from(el.children)
        .filter((hijo) => !hijo.classList.contains('material-symbols-outlined'))
        .map((hijo) => (hijo.textContent ?? '').trim())
        .filter(Boolean)
        .join(' ');
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingCardsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PricingCardsComponent);
    fixture.componentRef.setInput('planes', PLANES);
  });

  it('con variante base destaca el precio base y el chip muestra el ilimitado', () => {
    fixture.componentRef.setInput('variante', 'base');
    fixture.detectChanges();

    expect(textos('.pricing-card__amount')).toEqual(['89', '249', '449']);
    const chips = textos('.pricing-card__alt-chip');
    expect(chips).toEqual([
      'Ilimitado 109 €/mes',
      'Ilimitado 279 €/mes',
      'Ilimitado 489 €/mes',
    ]);
    expect(textos('.pricing-card__feature')).toContain('Hasta 150 pacientes');
  });

  it('con variante ilimitada destaca el precio ilimitado y el chip muestra base + cap', () => {
    fixture.componentRef.setInput('variante', 'ilimitada');
    fixture.detectChanges();

    expect(textos('.pricing-card__amount')).toEqual(['109', '279', '489']);
    const chips = textos('.pricing-card__alt-chip');
    expect(chips).toEqual([
      'Base hasta 150 pacientes 89 €/mes',
      'Base hasta 300 pacientes 249 €/mes',
      'Base hasta 500 pacientes 449 €/mes',
    ]);
    expect(textos('.pricing-card__feature')).toContain('Pacientes ilimitados');
  });

  it('marca la card del plan actual con el badge "Plan actual"', () => {
    fixture.componentRef.setInput('variante', 'base');
    fixture.componentRef.setInput('planActualNombre', 'Smart');
    fixture.detectChanges();

    const current = (fixture.nativeElement as HTMLElement).querySelector(
      '.pricing-card.is-current .pricing-card__name',
    );
    expect(current?.textContent?.trim()).toBe('Smart');
  });
});
