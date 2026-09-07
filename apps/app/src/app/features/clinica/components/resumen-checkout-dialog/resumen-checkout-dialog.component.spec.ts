import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  ResumenCheckoutDialogComponent,
  type ResumenCheckoutDialogData,
} from './resumen-checkout-dialog.component';

// 2026-10-09T22:30:00Z → 10/10/2026 en Madrid; el DatePipe usa la TZ local
// del runner, así que el assert solo comprueba el año y el prefijo "El ".
const TRIAL_END = Date.UTC(2026, 9, 9, 22, 30);

describe('ResumenCheckoutDialogComponent', () => {
  let fixture: ComponentFixture<ResumenCheckoutDialogComponent>;
  let closeSpy: jasmine.Spy;

  async function crear(data: ResumenCheckoutDialogData): Promise<void> {
    closeSpy = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [ResumenCheckoutDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ResumenCheckoutDialogComponent);
    fixture.detectChanges();
  }

  /** Texto plano de un selector sin las ligaduras de Material Symbols. */
  function texto(selector: string): string {
    const host = fixture.nativeElement as HTMLElement;
    const el = host.querySelector(selector);
    if (!el) return '';
    const clon = el.cloneNode(true) as HTMLElement;
    clon
      .querySelectorAll('.material-symbols-outlined')
      .forEach((icono) => icono.remove());
    return (clon.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function botones(): HTMLButtonElement[] {
    const host = fixture.nativeElement as HTMLElement;
    return Array.from(host.querySelectorAll('button'));
  }

  const base: ResumenCheckoutDialogData = {
    accion: 'create_subscription',
    esAMedida: false,
    planLabel: 'Smart Ilimitado',
    fisios: 3,
    importeMensualEur: 279,
  };

  it('pre-checkout: plan, importe base, ambos regímenes y cobro hoy', async () => {
    await crear(base);
    expect(texto('[data-testid="resumen-importe"]')).toBe('279 €/mes + imp.');
    const impuestos = texto('[data-testid="resumen-impuestos"]');
    expect(impuestos).toContain('Canarias');
    expect(impuestos).toContain('+7 % IGIC');
    expect(impuestos).toContain('298.53 €/mes');
    expect(impuestos).toContain('inversión del sujeto pasivo');
    expect(impuestos).toContain('279 €/mes');
    expect(texto('[data-testid="resumen-cobro"]')).toContain('Hoy, al confirmar');
    expect(texto('ui2-dialog-content')).toContain('3 fisioterapeutas');
  });

  it('trial con fecha: el cargo sale al terminar la prueba, no hoy', async () => {
    await crear({
      ...base,
      accion: 'attach_pm_end_trial',
      planLabel: 'Lonely',
      fisios: 1,
      importeMensualEur: 89,
      trialEnd: TRIAL_END,
    });
    const cobro = texto('[data-testid="resumen-cobro"]');
    expect(cobro).toMatch(/^El \d{2}\/10\/2026/);
    expect(cobro).toContain('periodo de prueba');
    expect(cobro).not.toContain('Hoy');
    expect(texto('ui2-dialog-content')).toContain('1 fisioterapeuta ');
    expect(texto('[data-testid="resumen-impuestos"]')).toContain('95.23 €/mes');
  });

  it('trial sin fecha: texto genérico', async () => {
    await crear({ ...base, accion: 'attach_pm_end_trial' });
    expect(texto('[data-testid="resumen-cobro"]')).toContain(
      'Al terminar tu periodo de prueba',
    );
  });

  it('a medida sin preview: "Según contrato" y sin cifras', async () => {
    await crear({
      ...base,
      accion: 'attach_pm_end_trial',
      esAMedida: true,
      planLabel: 'A medida',
      importeMensualEur: null,
      trialEnd: TRIAL_END,
    });
    expect(texto('[data-testid="resumen-importe"]')).toBe('Según contrato');
    const impuestos = texto('[data-testid="resumen-impuestos"]');
    expect(impuestos).not.toContain('€');
    expect(impuestos).toContain('+7 % IGIC');
  });

  it('Continuar cierra con true y Cancelar con false', async () => {
    await crear(base);
    const continuar = botones().find((b) =>
      (b.textContent ?? '').includes('Continuar a Stripe'),
    );
    const cancelar = botones().find((b) =>
      (b.textContent ?? '').includes('Cancelar'),
    );
    expect(continuar).withContext('botón continuar').toBeTruthy();
    expect(cancelar).withContext('botón cancelar').toBeTruthy();

    continuar!.click();
    expect(closeSpy).toHaveBeenCalledWith(true);

    cancelar!.click();
    expect(closeSpy).toHaveBeenCalledWith(false);
  });
});
