import { Injectable, signal, computed } from '@angular/core';

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
  private toastsSignal = signal<Toast[]>([]);

  toasts = computed(() => this.toastsSignal());

  private idCounter = 0;

  show(message: string, type: ToastType = 'info', options: ToastOptions = {}): string {
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
