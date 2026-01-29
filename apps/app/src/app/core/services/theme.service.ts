import { Injectable, inject, signal, effect } from '@angular/core';

import { ClinicasService } from '../../features/clinica/data-access/clinicas.service';
import type { Clinica } from '../../../types/global';
import { environment as env } from '../../../environments/environment';

interface ColorPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryAlpha10: string;
  primaryAlpha20: string;
  primaryAlpha30: string;
  primaryRgb: string;
  tertiary: string;
  tertiaryDark: string;
  tertiaryLight: string;
  tertiaryRgb: string;
  // Background gradient colors
  bgGradient1: string;
  bgGradient2: string;
  bgGradient3: string;
  bgGradient4: string;
  bgGradient5: string;
  bgGradient6: string;
  bgGradient7: string;
  bgGradient8: string;
  bgBubble: string;
  autofillBg: string;
  // SVG wave background colors
  svgWave1: string;
  svgWave2: string;
  svgWave3: string;
  svgWave4: string;
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

  private clinicasService = inject(ClinicasService);

  currentPrimary = signal<string>(this.DEFAULT_PRIMARY);
  currentTertiary = signal<string>(this.DEFAULT_TERTIARY);
  logoUrl = signal<string>(this.DEFAULT_LOGO);
  logoIconUrl = signal<string>(this.DEFAULT_LOGO_ICON);

  constructor() {
    // Aplicar colores por defecto al iniciar
    this.inyectarCSSVariables(this.calcularPaleta(this.DEFAULT_PRIMARY, this.DEFAULT_TERTIARY));

    // Effect que escucha cambios en la clínica seleccionada
    effect(() => {
      const clinica = this.clinicasService.selectedClinica();
      this.aplicarTemaClinica(clinica);
      this.actualizarLogo(clinica);
    });
  }

  /**
   * Aplica el tema de colores basado en la clínica proporcionada
   */
  aplicarTemaClinica(clinica: Clinica | null): void {
    const primary = clinica?.color_primario || this.DEFAULT_PRIMARY;
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
      const logoUrl = `${env.DIRECTUS_URL}/assets/${clinica.logo}`;
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

  /**
   * Calcula la paleta completa de colores a partir del color primario
   */
  private calcularPaleta(primaryHex: string, tertiaryHex: string): ColorPalette {
    const primaryHSL = this.hexToHSL(primaryHex);
    const primaryRGB = this.hexToRgb(primaryHex);

    const tertiaryHSL = this.hexToHSL(tertiaryHex);
    const tertiaryRGB = this.hexToRgb(tertiaryHex);

    // Base light color for gradient mixing (warm cream tone)
    const lightBase1 = { r: 255, g: 214, b: 153 }; // #ffd699
    const lightBase2 = { r: 255, g: 228, b: 184 }; // #ffe4b8
    const lightBase3 = { r: 255, g: 237, b: 214 }; // #ffedd6

    return {
      primary: primaryHex,
      primaryDark: this.hslToHex(primaryHSL.h, primaryHSL.s, Math.max(0, primaryHSL.l - 15)),
      primaryLight: this.hslToHex(primaryHSL.h, primaryHSL.s, Math.min(100, primaryHSL.l + 15)),
      primaryAlpha10: `rgba(${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}, 0.1)`,
      primaryAlpha20: `rgba(${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}, 0.2)`,
      primaryAlpha30: `rgba(${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}, 0.3)`,
      primaryRgb: `${primaryRGB.r}, ${primaryRGB.g}, ${primaryRGB.b}`,
      tertiary: tertiaryHex,
      tertiaryDark: this.hslToHex(tertiaryHSL.h, tertiaryHSL.s, Math.max(0, tertiaryHSL.l - 15)),
      tertiaryLight: this.hslToHex(tertiaryHSL.h, tertiaryHSL.s, Math.min(100, tertiaryHSL.l + 15)),
      tertiaryRgb: `${tertiaryRGB.r}, ${tertiaryRGB.g}, ${tertiaryRGB.b}`,
      // Background gradient colors - mixing primary with light bases
      bgGradient1: this.mixColors(primaryRGB, lightBase1, 0.60),
      bgGradient2: this.mixColors(primaryRGB, lightBase1, 0.50),
      bgGradient3: this.mixColors(primaryRGB, lightBase1, 0.40),
      bgGradient4: this.mixColors(primaryRGB, lightBase1, 0.30),
      bgGradient5: this.mixColors(primaryRGB, lightBase2, 0.25),
      bgGradient6: this.mixColors(primaryRGB, lightBase2, 0.20),
      bgGradient7: this.mixColors(primaryRGB, lightBase3, 0.15),
      bgGradient8: this.mixColors(primaryRGB, lightBase3, 0.10),
      bgBubble: this.mixColors(primaryRGB, lightBase1, 0.45),
      autofillBg: this.mixColors(primaryRGB, { r: 255, g: 255, b: 255 }, 0.05),
      // SVG wave colors - gradient from white to primary
      svgWave1: '#ffffff',
      svgWave2: this.mixColors(primaryRGB, { r: 255, g: 255, b: 255 }, 0.15),
      svgWave3: this.mixColors(primaryRGB, { r: 255, g: 255, b: 255 }, 0.50),
      svgWave4: this.hslToHex(primaryHSL.h, Math.min(100, primaryHSL.s + 10), Math.max(0, primaryHSL.l - 5)),
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

    // Tertiary colors
    root.style.setProperty('--kengo-tertiary', palette.tertiary);
    root.style.setProperty('--kengo-tertiary-dark', palette.tertiaryDark);
    root.style.setProperty('--kengo-tertiary-light', palette.tertiaryLight);
    root.style.setProperty('--kengo-tertiary-rgb', palette.tertiaryRgb);

    // Background gradient colors for animated background
    root.style.setProperty('--kengo-bg-gradient-1', palette.bgGradient1);
    root.style.setProperty('--kengo-bg-gradient-2', palette.bgGradient2);
    root.style.setProperty('--kengo-bg-gradient-3', palette.bgGradient3);
    root.style.setProperty('--kengo-bg-gradient-4', palette.bgGradient4);
    root.style.setProperty('--kengo-bg-gradient-5', palette.bgGradient5);
    root.style.setProperty('--kengo-bg-gradient-6', palette.bgGradient6);
    root.style.setProperty('--kengo-bg-gradient-7', palette.bgGradient7);
    root.style.setProperty('--kengo-bg-gradient-8', palette.bgGradient8);
    root.style.setProperty('--kengo-bg-bubble', palette.bgBubble);
    root.style.setProperty('--kengo-autofill-bg', palette.autofillBg);

    // SVG wave background colors
    root.style.setProperty('--kengo-svg-wave-1', palette.svgWave1);
    root.style.setProperty('--kengo-svg-wave-2', palette.svgWave2);
    root.style.setProperty('--kengo-svg-wave-3', palette.svgWave3);
    root.style.setProperty('--kengo-svg-wave-4', palette.svgWave4);
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
