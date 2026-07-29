import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  LEGAL_DOCS,
  LegalCookiesComponent,
  legalDocCanonicalUrl,
} from '@kengo/legal';
import { LegalPageShellComponent } from '../legal-page-shell.component';
import { applySeo } from '../../../shared/seo';

const META = LEGAL_DOCS['cookies'];

@Component({
  selector: 'web-legal-cookies-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LegalPageShellComponent, LegalCookiesComponent],
  template: `
    <web-legal-page-shell
      [title]="meta.title"
      [subtitle]="meta.description"
      [lastUpdated]="meta.lastUpdated"
    >
      <ui-legal-cookies />
    </web-legal-page-shell>
  `,
})
export class LegalCookiesPageComponent {
  protected readonly meta = META;

  constructor() {
    applySeo({
      title: META.title,
      description: META.description,
      canonical: legalDocCanonicalUrl('cookies'),
    });
  }
}
