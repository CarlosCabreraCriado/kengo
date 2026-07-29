import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LEGAL_DOCS,
  LegalPrivacidadComponent,
  legalDocCanonicalUrl,
} from '@kengo/legal';
import { LegalPageShellComponent } from '../legal-page-shell.component';
import { applySeo } from '../../../shared/seo';

const META = LEGAL_DOCS['privacidad'];

@Component({
  selector: 'web-legal-privacidad-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LegalPageShellComponent, LegalPrivacidadComponent],
  template: `
    <web-legal-page-shell
      [title]="meta.title"
      [subtitle]="meta.description"
      [lastUpdated]="meta.lastUpdated"
    >
      <ui-legal-privacidad />
    </web-legal-page-shell>
  `,
})
export class LegalPrivacidadPageComponent {
  protected readonly meta = META;

  constructor() {
    applySeo({
      title: META.title,
      description: META.description,
      canonical: legalDocCanonicalUrl('privacidad'),
    });
  }
}
