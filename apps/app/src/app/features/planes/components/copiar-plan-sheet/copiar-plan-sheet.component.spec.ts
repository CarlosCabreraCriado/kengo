import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import {
  CopiarPlanSheetComponent,
  type CopiarPlanSheetData,
} from './copiar-plan-sheet.component';

describe('CopiarPlanSheetComponent', () => {
  let fixture: ComponentFixture<CopiarPlanSheetComponent>;
  let closeSpy: jasmine.Spy;

  async function crear(data: CopiarPlanSheetData): Promise<void> {
    closeSpy = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [CopiarPlanSheetComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: closeSpy } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CopiarPlanSheetComponent);
    fixture.detectChanges();
  }

  function texto(): string {
    const host = fixture.nativeElement as HTMLElement;
    return (host.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function boton(testId: string): HTMLButtonElement {
    const host = fixture.nativeElement as HTMLElement;
    const el = host.querySelector(`[data-testid="${testId}"] button`);
    if (!el) throw new Error(`No hay botón en ${testId}`);
    return el as HTMLButtonElement;
  }

  it('muestra el nombre del paciente y el número de ejercicios', async () => {
    await crear({ pacienteNombre: 'Pablo Test', totalEjercicios: 4 });
    expect(texto()).toContain('Para Pablo Test');
    expect(texto()).toContain('4 ejercicios');
  });

  it('usa singular con un solo ejercicio', async () => {
    await crear({ pacienteNombre: 'Pablo Test', totalEjercicios: 1 });
    expect(texto()).toContain('1 ejercicio con su dosificación');
  });

  it('cierra con "mismo" y "otro" según la opción pulsada', async () => {
    await crear({ pacienteNombre: 'Pablo Test', totalEjercicios: 2 });
    boton('cps-mismo').click();
    expect(closeSpy).toHaveBeenCalledWith('mismo');
    boton('cps-otro').click();
    expect(closeSpy).toHaveBeenCalledWith('otro');
  });

  it('la X cierra con null', async () => {
    await crear({ pacienteNombre: 'Pablo Test', totalEjercicios: 2 });
    fixture.componentInstance.cerrar();
    expect(closeSpy).toHaveBeenCalledWith(null);
  });
});
