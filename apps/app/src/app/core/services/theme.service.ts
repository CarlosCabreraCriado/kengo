import { Injectable, inject, signal, effect } from '@angular/core';
import { rawAssetUrl } from '../utils/asset-url';

import { ClinicasService } from '../../features/clinica/data-access/clinicas.service';
import type { Clinica } from '../../../types/global';
interface ColorPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryAlpha10: string;
  primaryAlpha20: string;
  primaryAlpha30: string;
  primaryRgb: string;
  shadowCtaCoral: string;
  shadowPillCoral: string;
  shadowToggleCoral: string;
  tertiary: string;
  tertiaryDark: string;
  tertiaryLight: string;
  tertiaryRgb: string;
  autofillBg: string;
}

interface ThemeCacheV2 {
  v: 2;
  updatedAt: string;
  expiresAt: string;
  idClinica: string | null;
  colorPrimario: string;
  logoFileId: string | null;
  palette: ColorPalette;
  logoUrl: string;
  logoIconUrl: string;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly DEFAULT_PRIMARY = '#e75c3e';
  private readonly DEFAULT_TERTIARY = '#efc048';
  private readonly DEFAULT_LOGO = 'assets/logo-kengo-horizontal.svg';
  private readonly DEFAULT_LOGO_ICON = 'assets/logo.svg';
  private readonly CACHE_KEY = 'kengo:theme:v2';
  private readonly CACHE_TTL_DAYS = 30;

  private clinicasService = inject(ClinicasService);

  currentPrimary = signal<string>(this.DEFAULT_PRIMARY);
  currentTertiary = signal<string>(this.DEFAULT_TERTIARY);
  logoUrl = signal<string>(this.DEFAULT_LOGO);
  logoIconUrl = signal<string>(this.DEFAULT_LOGO_ICON);

  private cache: ThemeCacheV2 | null = null;

  constructor() {
    // Intentar restaurar tema desde caché para evitar flash de colores
    this.cache = this.leerCache();
    if (this.cache) {
      this.inyectarCSSVariables(this.cache.palette);
      this.currentPrimary.set(this.cache.colorPrimario);
      this.logoUrl.set(this.cache.logoUrl);
      this.logoIconUrl.set(this.cache.logoIconUrl);
      // Precargar imagen del logo en HTTP cache del navegador
      if (this.cache.logoFileId) {
        new Image().src = this.cache.logoUrl;
      }
    } else {
      this.inyectarCSSVariables(this.calcularPaleta(this.DEFAULT_PRIMARY, this.DEFAULT_TERTIARY));
    }

    // Effect que escucha cambios en la clínica seleccionada
    effect(() => {
      const clinica = this.clinicasService.selectedClinica();
      if (!clinica) return; // Caché o defaults ya están aplicados

      const cacheCoincide = this.cache
        && this.cache.idClinica === clinica.id
        && this.cache.colorPrimario === (clinica.colorPrimario || this.DEFAULT_PRIMARY)
        && this.cache.logoFileId === (clinica.logo || null);

      if (cacheCoincide) return; // Sin cambios, skip

      this.aplicarTemaClinica(clinica);
      this.actualizarLogo(clinica);
      this.guardarCache(clinica);
    });
  }

  /**
   * Aplica el tema de colores basado en la clínica proporcionada
   */
  aplicarTemaClinica(clinica: Clinica | null): void {
    const primary = clinica?.colorPrimario || this.DEFAULT_PRIMARY;
    const tertiary = this.DEFAULT_TERTIARY; // Por ahora solo primary es configurable

    this.currentPrimary.set(primary);
    this.currentTertiary.set(tertiary);

    const palette = this.calcularPaleta(primary, tertiary);
    this.inyectarCSSVariables(palette);

    console.log('[ThemeService] Tema aplicado:', { primary, tertiary });
  }

  /**
   * Actualiza las URLs de los logos basándose en la clínica
   */
  private actualizarLogo(clinica: Clinica | null): void {
    if (clinica?.logo) {
      const logoUrl = `${rawAssetUrl(clinica.logo)}`;
      this.logoUrl.set(logoUrl);
      this.logoIconUrl.set(logoUrl);
      console.log('[ThemeService] Logo de clínica aplicado:', logoUrl);
    } else {
      this.logoUrl.set(this.DEFAULT_LOGO);
      this.logoIconUrl.set(this.DEFAULT_LOGO_ICON);
      console.log('[ThemeService] Logo por defecto aplicado');
    }
  }

  /**
   * Restaura el logo por defecto (útil para handlers de error en imágenes)
   */
  resetLogo(): void {
    this.logoUrl.set(this.DEFAULT_LOGO);
    this.logoIconUrl.set(this.DEFAULT_LOGO_ICON);
  }

  private leerCache(): ThemeCacheV2 | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as ThemeCacheV2;
      if (data.v !== 2) return null;
      if (new Date(data.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      localStorage.removeItem(this.CACHE_KEY);
      return null;
    }
  }

  private guardarCache(clinica: Clinica): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const primary = clinica.colorPrimario || this.DEFAULT_PRIMARY;
    const logoFileId = clinica.logo || null;
    const logoUrl = logoFileId ? `${rawAssetUrl(logoFileId)}` : this.DEFAULT_LOGO;
    const logoIconUrl = logoFileId ? logoUrl : this.DEFAULT_LOGO_ICON;

    const cache: ThemeCacheV2 = {
      v: 2,
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      idClinica: clinica.id,
      colorPrimario: primary,
      logoFileId,
      palette: this.calcularPaleta(primary, this.DEFAULT_TERTIARY),
      logoUrl,
      logoIconUrl,
    };

    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
      this.cache = cache;
    } catch {
      // localStorage lleno o no disponible — ignorar
    }
  }

  /**
   * Calcula la paleta completa de colores a partir del color primario
   */
  private calcularPaleta(primaryHex: string, tertiaryHex: string): ColorPalette {
    const primaryHSL = this.hexToHSL(primaryHex);
    const primaryRGB = this.hexToRgb(primaryHex);

    const tertiaryHSL = this.hexToHSL(tertiaryHex);
    const tertiaryRGB = this.hexToRgb(tertiaryHex);

    const rgba = (a: number) =>
      `rgba(${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}, ${a})`;

    return {
      primary: primaryHex,
      primaryDark: this.hslToHex(primaryHSL.h, primaryHSL.s, Math.max(0, primaryHSL.l - 15)),
      primaryLight: this.hslToHex(primaryHSL.h, primaryHSL.s, Math.min(100, primaryHSL.l + 15)),
      primaryAlpha10: rgba(0.1),
      primaryAlpha20: rgba(0.2),
      primaryAlpha30: rgba(0.3),
      primaryRgb: `${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}`,
      shadowCtaCoral: `0 12px 28px -6px ${rgba(0.5)}`,
      shadowPillCoral: `0 4px 10px -2px ${rgba(0.4)}`,
      shadowToggleCoral: `0 4px 10px -2px ${rgba(0.35)}`,
      tertiary: tertiaryHex,
      tertiaryDark: this.hslToHex(tertiaryHSL.h, tertiaryHSL.s, Math.max(0, tertiaryHSL.l - 15)),
      tertiaryLight: this.hslToHex(tertiaryHSL.h, tertiaryHSL.s, Math.min(100, tertiaryHSL.l + 15)),
      tertiaryRgb: `${tertiaryRGB.r}, ${tertiaryRGB.g}, ${tertiaryRGB.b}`,
      autofillBg: this.mixColors(primaryRGB, { r: 255, g: 255, b: 255 }, 0.05),
    };
  }

  /**
   * Mezcla dos colores RGB con un porcentaje dado del primer color
   */
  private mixColors(color1: RGB, color2: RGB, ratio: number): string {
    const r = Math.round(color1.r * ratio + color2.r * (1 - ratio));
    const g = Math.round(color1.g * ratio + color2.g * (1 - ratio));
    const b = Math.round(color1.b * ratio + color2.b * (1 - ratio));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Inyecta las CSS variables en el documento
   */
  private inyectarCSSVariables(palette: ColorPalette): void {
    const root = document.documentElement;

    // Primary colors
    root.style.setProperty('--kengo-primary', palette.primary);
    root.style.setProperty('--kengo-primary-dark', palette.primaryDark);
    root.style.setProperty('--kengo-primary-light', palette.primaryLight);
    root.style.setProperty('--kengo-primary-alpha-10', palette.primaryAlpha10);
    root.style.setProperty('--kengo-primary-alpha-20', palette.primaryAlpha20);
    root.style.setProperty('--kengo-primary-alpha-30', palette.primaryAlpha30);
    root.style.setProperty('--kengo-primary-rgb', palette.primaryRgb);
    root.style.setProperty('--kengo-shadow-primary', `0 4px 16px ${palette.primaryAlpha30}`);

    // V2 shadow tokens derivadas del primario (consumidas por button, pill, toggle, ...)
    root.style.setProperty('--shadow-cta-coral', palette.shadowCtaCoral);
    root.style.setProperty('--shadow-pill-coral', palette.shadowPillCoral);
    root.style.setProperty('--shadow-toggle-coral', palette.shadowToggleCoral);

    // Tertiary colors
    root.style.setProperty('--kengo-tertiary', palette.tertiary);
    root.style.setProperty('--kengo-tertiary-dark', palette.tertiaryDark);
    root.style.setProperty('--kengo-tertiary-light', palette.tertiaryLight);
    root.style.setProperty('--kengo-tertiary-rgb', palette.tertiaryRgb);

    root.style.setProperty('--kengo-autofill-bg', palette.autofillBg);

    // Actualizar theme-color del notch/status bar en móvil
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.primary);
  }

  /**
   * Convierte un color hexadecimal a HSL
   */
  private hexToHSL(hex: string): HSL {
    const rgb = this.hexToRgb(hex);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Convierte HSL a hexadecimal
   */
  private hslToHex(h: number, s: number, l: number): string {
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convierte un color hexadecimal a RGB
   */
  private hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { r: 231, g: 92, b: 62 }; // Default primary RGB
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
}
