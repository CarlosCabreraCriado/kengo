import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LEGAL_DOCS,
  LegalTerminosComponent,
  legalDocCanonicalUrl,
} from '@kengo/legal';
import { LegalPageShellComponent } from '../legal-page-shell.component';
import { applySeo } from '../../../shared/seo';

const META = LEGAL_DOCS['terminos'];

@Component({
  selector: 'web-legal-terminos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LegalPageShellComponent, LegalTerminosComponent],
  template: `
    <web-legal-page-shell
      [title]="meta.title"
      [subtitle]="meta.description"
      [lastUpdated]="meta.lastUpdated"
    >
      <ui-legal-terminos />
    </web-legal-page-shell>
  `,
})
export class LegalTerminosPageComponent {
  protected readonly meta = META;

  constructor() {
    applySeo({
      title: META.title,
      description: META.description,
      canonical: legalDocCanonicalUrl('terminos'),
    });
  }
}
