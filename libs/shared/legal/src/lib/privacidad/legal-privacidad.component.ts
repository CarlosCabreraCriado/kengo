import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Texto de la política de privacidad. Componente de contenido puro: no
 * conoce el router, ni el catálogo `ui-v2`, ni ningún servicio. El host
 * decide si lo pinta dentro de un diálogo (app) o de una página (landing).
 */
@Component({
  selector: 'ui-legal-privacidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-privacidad.component.html',
  styleUrl: '../legal-prose.css',
})
export class LegalPrivacidadComponent {}
