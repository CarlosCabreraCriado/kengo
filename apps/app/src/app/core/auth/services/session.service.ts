import {
  Injectable,
  Injector,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { RolUsuario, Usuario, Puesto } from '../../../../types/global';
import { ConvexService, NotAuthenticatedError } from '../../convex/convex.service';
import { BetterAuthService } from './better-auth.service';
import { ClinicaActivaService } from './clinica-activa.service';
import { SESSION_RESETTABLES } from '../session-resettable';
import { LoggerService } from '../../services/logger.service';
import { api } from '../../../../../../../convex/_generated/api';
import { rawAssetUrl } from '../../utils/asset-url';

/**
 * Estructura del cache local del usuario. Solo campos no sensibles que
 * afecten al render del shell (nombre, avatar, clínicas). El modo
 * fisio/paciente NO se cachea aquí (vive aparte en `localStorage:kengo:modo`).
 */
interface UsuarioCacheV1 {
  v: 1;
  ts: number;
  usuario: Usuario;
}

const MODO_STORAGE_KEY = 'kengo:modo';

function leerModoPersistido(): RolUsuario | null {
  try {
    const v = localStorage.getItem(MODO_STORAGE_KEY);
    return v === 'fisio' || v === 'paciente' ? v : null;
  } catch {
    return null;
  }
}

/**
 * SessionService — gestiona el estado del usuario autenticado.
 * Tras la consolidación a Convex-only, esta clase consume exclusivamente
 * `api.users.queries.me`. La cookie/sesión la gestiona Better-Auth.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly USER_CACHE_KEY = 'kengo:user-cache:v1';
  private readonly USER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  private clinicaActiva = inject(ClinicaActivaService);

  /**
   * Preferencia local del usuario sobre el modo activo. Está acotada por
   * `puedeAlternarModo`: si el puesto en la clínica activa no permite
   * `'fisio'`, un `effect` la fuerza a `'paciente'`. La preferencia se
   * persiste en `localStorage:kengo:modo` para sobrevivir reloads.
   */
  private _rolUsuario = signal<RolUsuario>(
    typeof window !== 'undefined' ? leerModoPersistido() ?? 'fisio' : 'fisio',
  );
  public rolUsuario = computed<RolUsuario>(() => this._rolUsuario());

  /**
   * `true` cuando el puesto del usuario en la clínica activa permite operar
   * como fisio (puesto `fisio` o `admin`). Cuando es `false`, el toggle de
   * modo se oculta en la UI y `_rolUsuario` queda fijado en `'paciente'`.
   */
  public puedeAlternarModo = computed(() => {
    const id = this.clinicaActiva.selectedClinicaId();
    const clinicas = this._usuario()?.clinicas ?? [];
    if (!id) return clinicas.some((c) => c.puesto === 'fisio' || c.puesto === 'admin');
    const m = clinicas.find((c) => c.clinicId === id);
    return m?.puesto === 'fisio' || m?.puesto === 'admin';
  });

  /**
   * Effect que mantiene `_rolUsuario` consistente con `puedeAlternarModo`:
   * cuando el puesto activo no permite fisio, fuerza la preferencia a
   * `'paciente'`. Se ejecuta al cargar el usuario, al cambiar de clínica
   * activa o al actualizar membresías.
   */
  private readonly sincronizadorModo = effect(() => {
    if (!this.puedeAlternarModo() && this._rolUsuario() !== 'paciente') {
      this._rolUsuario.set('paciente');
      try {
        localStorage.removeItem(MODO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  });

  private _usuario = signal<Usuario | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  // Gate del primer paint: false hasta que termina la primera resolución de
  // sesión (con o sin usuario). Evita renderizar shells legacy/V2 con datos
  // por defecto antes de saber el rol real.
  private _sesionInicializada = signal<boolean>(false);
  // True cuando había sesión guardada pero no se pudo validar por un fallo
  // recuperable (504/timeout/red). Se distingue de "no autenticado": en este
  // caso NO debe redirigirse al login y debe mostrarse la pantalla de error
  // de conexión con reintento manual.
  private _errorConexion = signal<boolean>(false);

  public usuario = computed(() => this._usuario());
  public isLoggedIn = computed(() => this._usuario() !== null);
  public loading = computed(() => this._loading());
  public error = computed(() => this._error());
  public sesionInicializada = computed(() => this._sesionInicializada());
  public errorConexion = computed(() => this._errorConexion());
  public nombreCompleto = computed(() => {
    const u = this._usuario();
    return u ? `${u.first_name} ${u.last_name}`.trim() : '';
  });
  public misclinicas = computed(() => this._usuario()?.clinicas ?? []);
  // True cuando el usuario está autenticado pero todavía no pertenece a ninguna
  // clínica. Se usa por el OnboardingGuard para enviar al flow de bienvenida.
  public sinClinica = computed(() => {
    const u = this._usuario();
    return u !== null && (u.clinicas?.length ?? 0) === 0;
  });

  // === MODO ACTIVO (dinámico, lo que el usuario ve/hace ahora) ===
  public enModoFisio = computed(() => this.rolUsuario() === 'fisio');
  public enModoPaciente = computed(() => this.rolUsuario() === 'paciente');

  // === CAPACIDAD (estático, derivado del usuario) ===
  public tieneCapacidadFisio = computed(
    () => this._usuario()?.esFisio ?? false,
  );
  public tieneCapacidadPaciente = computed(
    () => this._usuario()?.esPaciente ?? false,
  );
  public esAdmin = computed(() =>
    (this._usuario()?.clinicas ?? []).some((c) => c.puesto === 'admin'),
  );

  // === REGLAS DE NEGOCIO (semánticas, basadas en modo) ===
  // Si en el futuro la regla cambia (ej. admins en modo paciente sí pueden
  // crear planes), se modifica solo el computed correspondiente.
  public puedeGestionarPacientes = computed(() => this.enModoFisio());
  public puedeCrearPlanes = computed(() => this.enModoFisio());
  public puedeCrearRutinas = computed(() => this.enModoFisio());
  public puedeEditarRecursos = computed(() => this.enModoFisio());
  public puedeRealizarSesion = computed(() => this.enModoPaciente());
  public puedeAsignarResponsables = computed(
    () => this.enModoFisio() && this.esAdmin(),
  );
  public puedeRecibirNotificaciones = computed(() => this.enModoFisio());

  private convex = inject(ConvexService);
  private betterAuth = inject(BetterAuthService);
  private logger = inject(LoggerService);
  // Inyectamos el Injector y resolvemos SESSION_RESETTABLES lazy dentro de
  // `limpiar()`. Resolverlo en construcción provocaría una dependencia
  // circular: los servicios resettable (PlanBuilderService, etc.) inyectan
  // a su vez `SessionService`.
  private rootInjector = inject(Injector);

  constructor() {
    // Hidratación rápida desde localStorage para acelerar `sesionInicializada`
    // en cold start con sesión válida. Solo aplica si:
    //   1) Better-Auth indica que hay sesión guardada (cookie/token).
    //   2) Existe un cache de usuario no expirado.
    //   3) No estamos en el flujo /magic (consume token y reemplaza usuario).
    // Tras hidratar, `cargarMiUsuario()` (invocado por AuthService.iniciarApp)
    // refresca con el dato real de Convex sin desmontar el shell.
    this.intentarHidratarDesdeCache();
  }

  private intentarHidratarDesdeCache(): void {
    if (typeof window === 'undefined') return;
    if (window.location?.pathname?.startsWith('/magic')) return;
    if (!this.betterAuth.hasStoredSession()) {
      this.limpiarCacheUsuario();
      return;
    }
    const cached = this.leerCacheUsuario();
    if (!cached) return;
    this._usuario.set(cached.usuario);
    this._sesionInicializada.set(true);
  }

  private leerCacheUsuario(): UsuarioCacheV1 | null {
    try {
      const raw = localStorage.getItem(this.USER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UsuarioCacheV1;
      if (parsed?.v !== 1 || !parsed.usuario) return null;
      if (Date.now() - parsed.ts > this.USER_CACHE_TTL_MS) {
        localStorage.removeItem(this.USER_CACHE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private guardarCacheUsuario(): void {
    try {
      const usuario = this._usuario();
      if (!usuario) return;
      const data: UsuarioCacheV1 = {
        v: 1,
        ts: Date.now(),
        usuario,
      };
      localStorage.setItem(this.USER_CACHE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  /** Borra el cache local del usuario. Llamar al hacer logout. */
  limpiarCacheUsuario(): void {
    try {
      localStorage.removeItem(this.USER_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  // Granulares por clínica (no son computeds porque parametrizan)
  esAdminEnClinica(clinicaId: string): boolean {
    return (this._usuario()?.clinicas ?? []).some(
      (c) => c.clinicId === clinicaId && c.puesto === 'admin',
    );
  }

  tienePuestoEnClinica(clinicaId: string, puesto: Puesto): boolean {
    return (this._usuario()?.clinicas ?? []).some(
      (c) => c.clinicId === clinicaId && c.puesto === puesto,
    );
  }

  /**
   * Establece el modo activo como preferencia local del usuario. Si la
   * clínica activa no permite `'fisio'`, las llamadas con `rol = 'fisio'`
   * se ignoran (defensivo). La preferencia se persiste en
   * `localStorage:kengo:modo`.
   */
  setRolUsuario(rol: RolUsuario) {
    if (rol === 'fisio' && !this.puedeAlternarModo()) return;
    this._rolUsuario.set(rol);
    try {
      localStorage.setItem(MODO_STORAGE_KEY, rol);
    } catch {
      /* ignore */
    }
  }

  toggleRolUsuario() {
    const next: RolUsuario =
      this._rolUsuario() === 'fisio' ? 'paciente' : 'fisio';
    this.setRolUsuario(next);
  }

  inicializarApp() {
    this.cargarMiUsuario();
  }

  marcarSesionInicializada(): void {
    this._sesionInicializada.set(true);
  }

  marcarErrorConexion(): void {
    this._errorConexion.set(true);
  }

  limpiarErrorConexion(): void {
    this._errorConexion.set(false);
  }

  async refreshUsuario() {
    return this.cargarMiUsuario();
  }

  /**
   * Limpia el usuario actual del estado (sin tocar la sesión Better-Auth).
   *
   * Importante: NO se resetea `_sesionInicializada`. Si lo pusiéramos a false
   * aquí, el AppComponent re-renderizaría el splash gate (`@if
   * (!sesionInicializada)`) durante la transición a `/login` y produciría un
   * flash visual. La página de login no depende de este flag para renderizar.
   */
  limpiar(): void {
    this._usuario.set(null);
    this._error.set(null);
    this._loading.set(false);
    this._errorConexion.set(false);
    this.clinicaActiva.clear();
    this.limpiarCacheUsuario();
    this.purgarStorageDeSesion();
    this.resetearServiciosDeSesion();
  }

  /**
   * Purga toda clave de `localStorage` cuyo contenido esté ligado a la
   * sesión del usuario que acaba de cerrar. Esto bloquea la fuga del
   * carrito de ejercicios y otros artefactos cuando otro usuario inicia
   * sesión en el mismo navegador.
   *
   * Las claves de `kengo:plan_builder:*` y `kengo:rutina_builder:*` las
   * purgan los propios servicios resettable; aquí solo cubrimos las que
   * no tienen dueño en `SESSION_RESETTABLES`.
   */
  private purgarStorageDeSesion(): void {
    const keys = [
      'carrito:last_fisio_id',
      'carrito:last_paciente_id',
      'kengo:sesion_activa:v2',
      'kengo:mis-pacientes:filtro',
      'kengo:sidebar-collapsed',
    ];
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
      } catch {
        // localStorage puede fallar en modo privado; ignorar.
      }
    }
  }

  /**
   * Notifica a cada servicio singleton registrado en `SESSION_RESETTABLES`
   * que debe descartar el estado de la sesión que acaba de cerrar. El
   * try/catch por servicio garantiza que un fallo aislado no bloquee
   * la cadena de logout (debe ser irrevocable).
   */
  private resetearServiciosDeSesion(): void {
    const resettables = this.rootInjector.get(SESSION_RESETTABLES, []);
    for (const svc of resettables) {
      try {
        svc.resetSessionState();
      } catch (err) {
        this.logger.warn(
          '[SessionService.limpiar] resetSessionState falló:',
          err,
        );
      }
    }
  }

  async cargarMiUsuario(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      if (!this.betterAuth.hasStoredSession()) {
        this._usuario.set(null);
        this.limpiarCacheUsuario();
        return;
      }

      const convexUser = await this.convex.query(api.users.queries.me, {});
      if (!convexUser) {
        this._usuario.set(null);
        this.limpiarCacheUsuario();
        return;
      }

      const usuario = this.transformarUsuarioConvex(convexUser);
      this._usuario.set(usuario);

      if (usuario.esFisio) {
        localStorage.setItem('carrito:last_fisio_id', usuario.id);
      } else {
        localStorage.removeItem('carrito:last_fisio_id');
      }
    } catch (err: unknown) {
      // NotAuthenticatedError es esperado cuando el cliente aún no tiene
      // token (arranque en curso, refresh en flight). No spamear console
      // como error; el AuthGuard / overlay ya guían al usuario.
      if (err instanceof NotAuthenticatedError) {
        this.logger.warn(
          '[SessionService] cargarMiUsuario abortado: cliente sin auth',
        );
      } else {
        this.logger.error('Error al cargar el usuario:', err);
      }
      this._error.set('No se pudo cargar el usuario');
      this._usuario.set(null);
      localStorage.removeItem('carrito:last_fisio_id');
      this.limpiarCacheUsuario();
    } finally {
      this._loading.set(false);
      this._sesionInicializada.set(true);
      // Persistir cache solo si la carga terminó con un usuario válido. En
      // los caminos de error/null ya invocamos limpiarCacheUsuario() arriba.
      if (this._usuario()) this.guardarCacheUsuario();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformarUsuarioConvex(u: any): Usuario {
    const clinicas =
      u.clinicas?.map((c: any) => ({
        clinicId: c.clinicId ?? '',
        puesto: (c.puesto ?? null) as Puesto | null,
      })) || [];

    // Si vienen `esFisio`/`esPaciente` en el doc usamos esos. Si no, los
    // computamos desde las clínicas (caso de queries que no enriquecen flags).
    let esFisio = u.esFisio;
    let esPaciente = u.esPaciente;
    if (esFisio === undefined && esPaciente === undefined) {
      const computed = this.computeRoleFromClinics(clinicas);
      esFisio = computed.esFisio;
      esPaciente = computed.esPaciente;
    }

    return {
      id: u._id,
      convexId: u._id,
      avatar: u.avatar ?? null,
      avatar_url: u.avatar ? rawAssetUrl(u.avatar) : undefined,
      first_name: u.firstName ?? '',
      last_name: u.lastName ?? '',
      email: u.email ?? '',
      email_verified: u.emailVerified ?? false,
      telefono: u.telefono || undefined,
      direccion: u.direccion || undefined,
      postal: u.postal || undefined,
      detalle: u.detalle
        ? {
            dni: u.detalle.dni ?? '',
            telefono: u.detalle.telefono ?? u.telefono ?? '',
            direccion: u.detalle.direccion ?? u.direccion ?? '',
            postal: u.detalle.postal ?? u.postal ?? '',
          }
        : null,
      clinicas,
      esFisio: esFisio ?? false,
      esPaciente: esPaciente ?? true,
      numero_colegiado: u.numeroColegiado || undefined,
    };
  }

  private computeRoleFromClinics(
    clinicas: { puesto: Puesto | null }[],
  ): { esFisio: boolean; esPaciente: boolean } {
    if (!clinicas || clinicas.length === 0) {
      return { esFisio: false, esPaciente: true };
    }

    const hasFisioAccess = clinicas.some(
      (c) => c.puesto === 'fisio' || c.puesto === 'admin',
    );
    const hasPacienteAccess = clinicas.some((c) => c.puesto === 'paciente');

    return {
      esFisio: hasFisioAccess,
      esPaciente: hasPacienteAccess || !hasFisioAccess,
    };
  }
}
