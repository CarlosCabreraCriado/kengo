import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { of } from 'rxjs';

import { PlanDetailComponent } from './plan-detail.component';
import { PlanesService } from '../../data-access/planes.service';
import { PlanBuilderService } from '../../data-access/plan-builder.service';
import { CumplimientoService } from '../../../pacientes/data-access/cumplimiento.service';
import { SessionService } from '../../../../core/auth/services/session.service';
import { PageLoaderService } from '../../../../core/services/page-loader.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { DialogService, ToastService } from '../../../../../app/shared';
import type { PlanCompleto, Usuario } from '../../../../../types/global';

const PACIENTE = {
  id: 'pac1',
  first_name: 'Pablo',
  last_name: 'Test',
  email: 'pablo@test.local',
} as Usuario;

function planDePrueba(overrides: Partial<PlanCompleto> = {}): PlanCompleto {
  return {
    id: 'plan1',
    titulo: 'Plan lumbar',
    descripcion: '',
    estado: 'activo',
    fechaInicio: '2026-01-10',
    fechaFin: '2026-02-10',
    version: 1,
    paciente: PACIENTE,
    fisio: { id: 'fisio1', first_name: 'Fisio', last_name: 'Uno' } as Usuario,
    items: [
      {
        sort: 1,
        ejercicio: {
          id: 'e1',
          nombre: 'Puente glúteo',
          descripcion: '',
          categoria: [],
          video: '',
          portada: '',
        },
        series: 3,
        repeticiones: 12,
        diasSemana: ['L', 'X', 'V'],
      },
    ],
    ...overrides,
  } as PlanCompleto;
}

describe('PlanDetailComponent — copiar plan y reset del carrito', () => {
  let fixture: ComponentFixture<PlanDetailComponent>;
  let builder: {
    isEditMode: ReturnType<typeof signal<boolean>>;
    items: ReturnType<typeof signal<unknown[]>>;
    resetForNewPlan: jasmine.Spy;
    loadFromPlan: jasmine.Spy;
    countItemsFor: jasmine.Spy;
    navigateAndOpenDrawer: jasmine.Spy;
    getPacienteById: jasmine.Spy;
  };
  let dialogService: { openSheet: jasmine.Spy; confirm: jasmine.Spy; openForm: jasmine.Spy };
  let cdkDialog: { open: jasmine.Spy };
  let toast: { success: jasmine.Spy; error: jasmine.Spy; warning: jasmine.Spy };
  let session: {
    puedeEditarRecursos: ReturnType<typeof signal<boolean>>;
    enModoPaciente: ReturnType<typeof signal<boolean>>;
    puedeGestionarPacientes: ReturnType<typeof signal<boolean>>;
  };

  async function crear(opts: {
    plan?: PlanCompleto;
    queryParams?: Record<string, string>;
    editMode?: boolean;
    puedeEditar?: boolean;
  } = {}): Promise<void> {
    builder = {
      isEditMode: signal(opts.editMode ?? false),
      items: signal<unknown[]>([]),
      resetForNewPlan: jasmine.createSpy('resetForNewPlan'),
      loadFromPlan: jasmine
        .createSpy('loadFromPlan')
        .and.returnValue({ cargados: 1, omitidos: 0 }),
      countItemsFor: jasmine.createSpy('countItemsFor').and.returnValue(0),
      navigateAndOpenDrawer: jasmine.createSpy('navigateAndOpenDrawer'),
      getPacienteById: jasmine.createSpy('getPacienteById').and.resolveTo(PACIENTE),
    };
    dialogService = {
      openSheet: jasmine.createSpy('openSheet').and.returnValue({ closed: of('mismo') }),
      confirm: jasmine.createSpy('confirm').and.resolveTo(true),
      openForm: jasmine.createSpy('openForm'),
    };
    cdkDialog = { open: jasmine.createSpy('open') };
    toast = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
      warning: jasmine.createSpy('warning'),
    };
    session = {
      puedeEditarRecursos: signal(opts.puedeEditar ?? true),
      enModoPaciente: signal(false),
      puedeGestionarPacientes: signal(true),
    };

    await TestBed.configureTestingModule({
      imports: [PlanDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { params: { id: 'plan1' }, queryParams: opts.queryParams ?? {} },
          },
        },
        {
          provide: PlanesService,
          useValue: {
            getPlanById: jasmine.createSpy().and.resolveTo(opts.plan ?? planDePrueba()),
            checkPlanHasActivity: jasmine.createSpy().and.resolveTo(false),
          },
        },
        { provide: PlanBuilderService, useValue: builder },
        {
          provide: CumplimientoService,
          useValue: {
            getCumplimiento: jasmine
              .createSpy()
              .and.resolveTo({ resumen: { diasProgramados: 0, adherenciaReal: 0 }, dias: [] }),
          },
        },
        { provide: SessionService, useValue: session },
        { provide: DialogService, useValue: dialogService },
        { provide: Dialog, useValue: cdkDialog },
        { provide: ToastService, useValue: toast },
        {
          provide: PageLoaderService,
          useValue: { register: jasmine.createSpy(), unregister: jasmine.createSpy() },
        },
        { provide: LoggerService, useValue: { warn: jasmine.createSpy(), error: jasmine.createSpy() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Por aria-label: en móvil el botón va solo con icono, sin texto. */
  function botonCopiar(): Element | null {
    const host = fixture.nativeElement as HTMLElement;
    return host.querySelector('button[aria-label="Copiar plan al carrito"]');
  }

  describe('reset del carrito al cargar el detalle', () => {
    it('NO resetea el carrito en una visita normal', async () => {
      await crear();
      expect(builder.resetForNewPlan).not.toHaveBeenCalled();
    });

    it('resetea al llegar con ?action=created', async () => {
      await crear({ queryParams: { action: 'created' } });
      expect(builder.resetForNewPlan).toHaveBeenCalled();
    });

    it('resetea si quedó un modo edición abandonado', async () => {
      await crear({ editMode: true });
      expect(builder.resetForNewPlan).toHaveBeenCalled();
    });
  });

  describe('botón Copiar', () => {
    it('se muestra al fisio incluso en un plan histórico (modificado)', async () => {
      await crear({ plan: planDePrueba({ estado: 'modificado', planSucesor: 'plan2' }) });
      expect(botonCopiar()).not.toBeNull();
    });

    it('no se muestra si el usuario no puede editar recursos', async () => {
      await crear({ puedeEditar: false });
      expect(botonCopiar()).toBeNull();
    });
  });

  describe('copiarPlan', () => {
    it('para el mismo paciente carga el carrito y navega al catálogo', async () => {
      await crear();
      await fixture.componentInstance.copiarPlan();

      expect(builder.getPacienteById).toHaveBeenCalledWith('pac1');
      expect(builder.loadFromPlan).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'plan1' }),
        PACIENTE,
      );
      expect(dialogService.confirm).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalled();
      expect(builder.navigateAndOpenDrawer).toHaveBeenCalled();
    });

    it('para otro paciente abre el selector y usa el elegido', async () => {
      await crear();
      const otra = { ...PACIENTE, id: 'pac2', first_name: 'Ana' } as Usuario;
      dialogService.openSheet.and.returnValue({ closed: of('otro') });
      cdkDialog.open.and.returnValue({ closed: of(otra) });

      await fixture.componentInstance.copiarPlan();

      expect(cdkDialog.open).toHaveBeenCalled();
      expect(builder.loadFromPlan).toHaveBeenCalledWith(jasmine.anything(), otra);
      expect(builder.navigateAndOpenDrawer).toHaveBeenCalled();
    });

    it('con carrito previo pide confirmación y no carga si se cancela', async () => {
      await crear();
      builder.items.set([{}, {}]);
      dialogService.confirm.and.resolveTo(false);

      await fixture.componentInstance.copiarPlan();

      expect(dialogService.confirm).toHaveBeenCalled();
      expect(builder.loadFromPlan).not.toHaveBeenCalled();
      expect(builder.navigateAndOpenDrawer).not.toHaveBeenCalled();
    });

    it('no hace nada si el fisio cierra el sheet', async () => {
      await crear();
      dialogService.openSheet.and.returnValue({ closed: of(null) });

      await fixture.componentInstance.copiarPlan();

      expect(builder.loadFromPlan).not.toHaveBeenCalled();
    });

    it('avisa de los omitidos y no navega si no se copió nada', async () => {
      await crear();
      builder.loadFromPlan.and.returnValue({ cargados: 0, omitidos: 1 });

      await fixture.componentInstance.copiarPlan();

      expect(toast.error).toHaveBeenCalled();
      expect(builder.navigateAndOpenDrawer).not.toHaveBeenCalled();
    });
  });
});
