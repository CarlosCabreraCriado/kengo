import { Injectable, signal, inject } from '@angular/core';
import { HapticsService } from '../../../core/services/haptics.service';
import type { SessionResettable } from '../../../core/auth/session-resettable';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}

/**
 * Máximo de toasts visibles a la vez. Por encima de esto la pila deja de ser
 * legible: son avisos efímeros apilados sobre el contenido, y el cuarto ya
 * empuja al primero fuera de la zona que el usuario está mirando.
 */
const MAX_VISIBLES = 3;

@Injectable({
  providedIn: 'root',
})
export class ToastService implements SessionResettable {
  private haptics = inject(HapticsService);

  private toastsSignal = signal<Toast[]>([]);

  readonly toasts = this.toastsSignal.asReadonly();

  private idCounter = 0;

  /**
   * Temporizadores de auto-cierre por id. Hay que poder cancelarlos: si no, un
   * toast cerrado a mano deja su `setTimeout` vivo hasta vencer, y al dispararse
   * despierta change detection para filtrar un id que ya no está.
   */
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  show(message: string, type: ToastType = 'info', options: ToastOptions = {}): string {
    const duration = options.duration ?? 4000;

    // Si ya hay un aviso idéntico en pantalla, se reinicia su temporizador en
    // vez de apilar una copia. Dos pulsaciones sobre el mismo botón bloqueado
    // son un solo hecho, y sin esto el usuario recibía dos tarjetas y dos
    // vibraciones por él.
    const existente = this.toastsSignal().find(
      (t) => t.message === message && t.type === type,
    );
    if (existente) {
      this.programarCierre(existente.id, duration);
      return existente.id;
    }

    // Feedback háptico acoplado al toast: es el punto por el que pasan todas
    // las confirmaciones y errores de la app, así que la vibración acompaña
    // al resultado de cada acción sin instrumentar cada feature. Va después
    // del dedupe para que un aviso repetido no vibre dos veces.
    if (type === 'success') {
      void this.haptics.impact('success');
    } else if (type === 'error' || type === 'warning') {
      void this.haptics.impact('warning');
    }

    const id = `toast-${++this.idCounter}`;

    const toast: Toast = {
      id,
      message,
      type,
      duration,
      action: options.action,
    };

    this.toastsSignal.update((toasts) => {
      const siguiente = [...toasts, toast];
      // Descarta los más antiguos (FIFO) cancelando sus temporizadores, para
      // no dejar timers huérfanos apuntando a ids que ya no están en la pila.
      while (siguiente.length > MAX_VISIBLES) {
        const descartado = siguiente.shift();
        if (descartado) this.cancelarCierre(descartado.id);
      }
      return siguiente;
    });

    this.programarCierre(id, duration);

    return id;
  }

  success(message: string, options: ToastOptions = {}): string {
    return this.show(message, 'success', options);
  }

  error(message: string, options: ToastOptions = {}): string {
    return this.show(message, 'error', { duration: 6000, ...options });
  }

  warning(message: string, options: ToastOptions = {}): string {
    return this.show(message, 'warning', options);
  }

  info(message: string, options: ToastOptions = {}): string {
    return this.show(message, 'info', options);
  }

  dismiss(id: string): void {
    this.cancelarCierre(id);
    this.toastsSignal.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toastsSignal.set([]);
  }

  /**
   * Los toasts no se limpian al navegar a propósito: varios guards lanzan su
   * aviso y redirigen acto seguido (`clinica-activa-resource.guard`,
   * `clinic-admin.guard`, `plan-editable.guard`), así que borrarlos en
   * `NavigationEnd` haría desaparecer justo el mensaje que explica el salto.
   * En el logout sí, que ahí no hay contexto que preservar.
   */
  resetSessionState(): void {
    this.dismissAll();
  }

  /** `duration <= 0` = toast permanente: solo se cierra a mano. */
  private programarCierre(id: string, duration: number): void {
    this.cancelarCierre(id);
    if (duration <= 0) return;
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), duration),
    );
  }

  private cancelarCierre(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
