import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Texto de la política de cookies. Componente de contenido puro (ver
 * `LegalPrivacidadComponent`).
 *
 * El inventario que describe se corresponde con el almacenamiento real del
 * sistema a fecha de la última revisión: solo almacenamiento técnico. Si algún
 * día se añade analítica o publicidad, hay que actualizar esta tabla **y**
 * añadir un banner de consentimiento.
 */
@Component({
  selector: 'ui-legal-cookies',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-cookies.component.html',
  styleUrl: '../legal-prose.css',
})
export class LegalCookiesComponent {}
