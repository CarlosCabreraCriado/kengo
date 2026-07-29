import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Texto del aviso legal (art. 10 LSSICE). Componente de contenido puro (ver
 * `LegalPrivacidadComponent`).
 */
@Component({
  selector: 'ui-legal-aviso-legal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-aviso-legal.component.html',
  styleUrl: '../legal-prose.css',
})
export class LegalAvisoLegalComponent {}
