import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LEGAL_DOCS,
  LegalAvisoLegalComponent,
  legalDocCanonicalUrl,
} from '@kengo/legal';
import { LegalPageShellComponent } from '../legal-page-shell.component';
import { applySeo } from '../../../shared/seo';

const META = LEGAL_DOCS['aviso-legal'];

@Component({
  selector: 'web-legal-aviso-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LegalPageShellComponent, LegalAvisoLegalComponent],
  template: `
    <web-legal-page-shell
      [title]="meta.title"
      [subtitle]="meta.description"
      [lastUpdated]="meta.lastUpdated"
    >
      <ui-legal-aviso-legal />
    </web-legal-page-shell>
  `,
})
export class LegalAvisoLegalPageComponent {
  protected readonly meta = META;

  constructor() {
    applySeo({
      title: META.title,
      description: META.description,
      canonical: legalDocCanonicalUrl('aviso-legal'),
    });
  }
}
