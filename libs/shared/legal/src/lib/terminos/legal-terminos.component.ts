import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Texto de los términos y condiciones. Componente de contenido puro (ver
 * `LegalPrivacidadComponent`).
 *
 * ⚠️ **Borrador pendiente de revisión jurídica.** Está redactado a partir del
 * funcionamiento real de la plataforma (suscripción por clínica, roles,
 * tratamiento de datos de salud), pero debe revisarlo un abogado antes de
 * darlo por definitivo. Lo mismo aplica a `LegalCookiesComponent` y
 * `LegalAvisoLegalComponent`.
 */
@Component({
  selector: 'ui-legal-terminos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-terminos.component.html',
  styleUrl: '../legal-prose.css',
})
export class LegalTerminosComponent {}
