import { Injectable, signal, computed, inject } from '@angular/core';
import { HapticsService } from '../../../core/services/haptics.service';

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

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private haptics = inject(HapticsService);

  private toastsSignal = signal<Toast[]>([]);

  toasts = computed(() => this.toastsSignal());

  private idCounter = 0;

  show(message: string, type: ToastType = 'info', options: ToastOptions = {}): string {
    // Feedback háptico acoplado al toast: es el punto por el que pasan todas
    // las confirmaciones y errores de la app, así que la vibración acompaña
    // al resultado de cada acción sin instrumentar cada feature.
    if (type === 'success') {
      void this.haptics.impact('success');
    } else if (type === 'error' || type === 'warning') {
      void this.haptics.impact('warning');
    }

    const id = `toast-${++this.idCounter}`;
    const duration = options.duration ?? 4000;

    const toast: Toast = {
      id,
      message,
      type,
      duration,
      action: options.action,
    };

    this.toastsSignal.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

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
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.toastsSignal.set([]);
  }
}
