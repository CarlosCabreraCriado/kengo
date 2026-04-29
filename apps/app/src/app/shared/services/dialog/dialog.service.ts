import { Injectable, TemplateRef, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';

export interface DialogOptions<D = unknown> {
  data?: D;
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  height?: string;
  maxHeight?: string;
  panelClass?: string | string[];
  hasBackdrop?: boolean;
  backdropClass?: string;
  disableClose?: boolean;
  autoFocus?: boolean;
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialog = inject(Dialog);

  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {}
  ): DialogRef<R, T> {
    return this.dialog.open<R, D, T>(component, {
      data: options.data,
      width: options.width ?? '100%',
      maxWidth: options.maxWidth ?? '500px',
      minWidth: options.minWidth,
      height: options.height,
      maxHeight: options.maxHeight ?? '90vh',
      panelClass: this.buildPanelClasses(options.panelClass),
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      disableClose: options.disableClose ?? false,
      autoFocus: options.autoFocus ?? true,
    });
  }

  openTemplate<D = unknown, R = unknown>(
    template: TemplateRef<unknown>,
    options: DialogOptions<D> = {}
  ): DialogRef<R> {
    return this.dialog.open<R, D>(template, {
      data: options.data,
      width: options.width ?? '100%',
      maxWidth: options.maxWidth ?? '500px',
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      disableClose: options.disableClose ?? false,
    });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  private buildPanelClasses(customClasses?: string | string[]): string[] {
    const baseClasses = ['ui-dialog-panel'];
    if (customClasses) {
      return baseClasses.concat(Array.isArray(customClasses) ? customClasses : [customClasses]);
    }
    return baseClasses;
  }
}
