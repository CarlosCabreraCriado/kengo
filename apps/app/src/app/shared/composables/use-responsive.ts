import { Signal, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { KENGO_BREAKPOINTS } from '../utils/breakpoints';

export interface ResponsiveSignals {
  esMobile: Signal<boolean>;
  esDesktop: Signal<boolean>;
}

export function useResponsive(): ResponsiveSignals {
  const breakpointObserver = inject(BreakpointObserver);

  const esMobile = toSignal(
    breakpointObserver
      .observe([KENGO_BREAKPOINTS.MOBILE])
      .pipe(map((r) => r.matches), takeUntilDestroyed()),
    { initialValue: false },
  );

  const esDesktop = toSignal(
    breakpointObserver
      .observe([KENGO_BREAKPOINTS.DESKTOP])
      .pipe(map((r) => r.matches), takeUntilDestroyed()),
    { initialValue: false },
  );

  return { esMobile, esDesktop };
}
