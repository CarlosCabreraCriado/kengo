import { Injectable, TemplateRef, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';

import { HapticsService } from '../../../core/services/haptics.service';
import type { Ui2DialogVariant } from '../../ui-v2';

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
  /** Si es true, oculta el botón "Cancelar" — útil para diálogos informativos. */
  hideCancel?: boolean;
}

/**
 * Defaults por variant. Solo `hasBackdrop` se aplica como override real
 * (fullscreen omite el backdrop por defecto). Las dimensiones (`width`,
 * `maxWidth`, `maxHeight`) NO se pasan al CDK porque CDK las aplica como
 * inline styles sobre el `.cdk-overlay-pane`, lo que tiene mayor especificidad
 * que la `panelClass` CSS y provoca clipping del contenido. La altura/anchura
 * se gestiona enteramente vía `.ui-dialog-panel--{variant}` (anchura) y
 * `.ui2-dialog--{variant}` (altura) en CSS.
 */
const VARIANT_DEFAULTS: Record<
  Ui2DialogVariant,
  Pick<DialogOptions, 'hasBackdrop'>
> = {
  standard:    {},
  informative: {},
  compact:     {},
  sheet:       {},
  fullscreen:  { hasBackdrop: false },
};

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialog = inject(Dialog);
  private haptics = inject(HapticsService);

  /**
   * Apertura genérica. Preferir los shortcuts tipados (`openInformative`,
   * `openForm`, `openSheet`, `openFullscreen`, `confirm`) para garantizar
   * coherencia visual entre diálogos del mismo tipo.
   */
  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {}
  ): DialogRef<R, T> {
    // Importante: NO aplicar defaults para width/maxWidth/maxHeight aquí. CDK
    // los pone como inline style en .cdk-overlay-pane y eso gana sobre el CSS
    // de la panelClass, causando que el contenido se salga del pane. Si el
    // caller los pasa explícitamente, se respetan; si no, la dimensión la
    // controla el CSS (panelClass + ui2-dialog--{variant}).
    return this.dialog.open<R, D, T>(component, {
      data: options.data,
      width: options.width,
      maxWidth: options.maxWidth,
      minWidth: options.minWidth,
      height: options.height,
      maxHeight: options.maxHeight,
      panelClass: this.buildPanelClasses(options.panelClass),
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      disableClose: options.disableClose ?? false,
      autoFocus: options.autoFocus ?? true,
    });
  }

  /** Diálogo informativo (legal, ayuda). Cierre solo por X del header o backdrop. */
  openInformative<T, D = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {},
  ): DialogRef<void, T> {
    return this.openWithVariant<T, D, void>(component, 'informative', options);
  }

  /** Diálogo de formulario (crear/editar entidad). */
  openForm<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {},
  ): DialogRef<R, T> {
    return this.openWithVariant<T, D, R>(component, 'standard', options);
  }

  /** Diálogo tipo bottom-sheet en móvil; modal centrado en desktop. */
  openSheet<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {},
  ): DialogRef<R, T> {
    const ref = this.openWithVariant<T, D, R>(component, 'sheet', options);
    this.installSheetExitAnimation(ref);
    return ref;
  }

  /**
   * Intercepta `close()` para reproducir un slide-down en móvil antes de
   * detach. CDK Dialog no soporta animaciones de salida nativas, así que
   * añadimos una clase al pane y al backdrop, esperamos a `animationend`
   * (con un safety net por timeout) y solo entonces llamamos al close real.
   * Cubre cierres por backdrop, ESC y `dialogRef.close()` programático.
   */
  private installSheetExitAnimation<R, T>(ref: DialogRef<R, T>): void {
    const overlayRef = ref.overlayRef;
    const pane = overlayRef?.overlayElement as HTMLElement | undefined;
    if (!pane) return;

    const originalClose = ref.close.bind(ref);
    let closing = false;

    ref.close = (
      result?: R,
      closeOptions?: Parameters<typeof originalClose>[1],
    ): void => {
      if (closing) return;

      const isMobile =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 767px)').matches;
      if (!isMobile) {
        originalClose(result, closeOptions);
        return;
      }

      closing = true;
      pane.classList.add('ui-dialog-panel--sheet-closing');
      overlayRef?.backdropElement?.classList.add('ui-dialog-backdrop--closing');

      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        originalClose(result, closeOptions);
      };
      pane.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 400);
    };
  }

  /** Diálogo fullscreen (image crop, vídeo, cámara). Sin backdrop por defecto. */
  openFullscreen<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    options: DialogOptions<D> = {},
  ): DialogRef<R, T> {
    return this.openWithVariant<T, D, R>(component, 'fullscreen', options);
  }

  openTemplate<D = unknown, R = unknown>(
    template: TemplateRef<unknown>,
    options: DialogOptions<D> = {}
  ): DialogRef<R> {
    return this.dialog.open<R, D>(template, {
      data: options.data,
      width: options.width,
      maxWidth: options.maxWidth,
      hasBackdrop: options.hasBackdrop ?? true,
      backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
      disableClose: options.disableClose ?? false,
    });
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  /** true si hay algún diálogo CDK abierto. Lo consulta BackButtonService. */
  get hasOpenDialogs(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  /**
   * Cierra el diálogo superior (el último abierto). Pasa por el `close`
   * interceptado del ref, así que los sheets conservan su animación de
   * salida. Usado por el botón atrás de Android.
   */
  closeTop(): void {
    this.dialog.openDialogs.at(-1)?.close();
  }

  /**
   * Diálogo de confirmación reutilizable. Reemplaza a `window.confirm()`, que
   * en WebView nativa (Capacitor) puede no renderizarse o bloquear el thread.
   * Resuelve a `true` si el usuario confirma, `false` si cancela o cierra.
   */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    // Aviso háptico pre-destructivo: la vibración acompaña a la aparición del
    // diálogo de confirmación peligrosa (borrar paciente, cancelar plan...).
    if (data.confirmVariant === 'danger') {
      void this.haptics.impact('warning');
    }

    // Import dinámico para evitar ciclo con el barrel de ui-v2 y para que el
    // bundle del service no arrastre el componente.
    const { Ui2ConfirmDialogComponent } = await import(
      '../../ui-v2/confirm-dialog/confirm-dialog.component'
    );
    const ref = this.openWithVariant<InstanceType<typeof Ui2ConfirmDialogComponent>, ConfirmDialogData, boolean>(
      Ui2ConfirmDialogComponent,
      'compact',
      { data },
    );
    const result = await firstValueFrom(ref.closed);
    return result === true;
  }

  private openWithVariant<T, D, R>(
    component: ComponentType<T>,
    variant: Ui2DialogVariant,
    options: DialogOptions<D>,
  ): DialogRef<R, T> {
    const defaults = VARIANT_DEFAULTS[variant];
    return this.open<T, D, R>(component, {
      ...options,
      hasBackdrop: options.hasBackdrop ?? defaults.hasBackdrop ?? true,
      panelClass: this.mergePanelClass(`ui-dialog-panel--${variant}`, options.panelClass),
    });
  }

  private mergePanelClass(
    variantClass: string,
    custom: string | string[] | undefined,
  ): string | string[] {
    if (!custom) return variantClass;
    const list = Array.isArray(custom) ? custom : [custom];
    return [variantClass, ...list];
  }

  private buildPanelClasses(customClasses?: string | string[]): string[] {
    const baseClasses = ['ui-dialog-panel'];
    if (customClasses) {
      return baseClasses.concat(Array.isArray(customClasses) ? customClasses : [customClasses]);
    }
    return baseClasses;
  }
}
