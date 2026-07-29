import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import {
  LEGAL_DOCS,
  LegalAvisoLegalComponent,
  LegalCookiesComponent,
  LegalPrivacidadComponent,
  LegalTerminosComponent,
  isLegalDocId,
  legalDocCanonicalUrl,
  type LegalDocId,
} from '@kengo/legal';
import {
  Ui2BackButtonComponent,
  Ui2BigTitleComponent,
  Ui2CardComponent,
  Ui2CreamBgComponent,
} from '../../../../shared/ui-v2';

/**
 * Página pública de un documento legal dentro de la aplicación.
 *
 * Existe por dos motivos:
 *  1. `kengoapp.com` es el dominio de la app y es la URL que se entrega a
 *     Apple y Google. Debe resolver a contenido real sin iniciar sesión: un
 *     revisor no siempre se loguea.
 *  2. En la app nativa el bundle se sirve en local, así que estos documentos
 *     siguen siendo accesibles sin conexión.
 *
 * La versión indexable es la de la landing (`www.kengoapp.com/legal/*`), así
 * que esta declara `noindex` y un `canonical` hacia allí para no competir en
 * buscadores consigo misma.
 */
@Component({
  selector: 'app-legal-doc',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Ui2CreamBgComponent,
    Ui2BackButtonComponent,
    Ui2BigTitleComponent,
    Ui2CardComponent,
    LegalPrivacidadComponent,
    LegalTerminosComponent,
    LegalCookiesComponent,
    LegalAvisoLegalComponent,
  ],
  templateUrl: './legal-doc.component.html',
  styleUrl: './legal-doc.component.css',
})
export class LegalDocComponent {
  private route = inject(ActivatedRoute);
  private title = inject(Title);
  private metaService = inject(Meta);
  private location = inject(Location);
  private router = inject(Router);
  private document = inject(DOCUMENT);

  /**
   * El documento llega por `data.doc` de la ruta (estático, resuelto en la
   * construcción). Si alguien registrase una ruta mal configurada, caemos a
   * privacidad en vez de romper la pantalla.
   */
  protected readonly doc: LegalDocId = isLegalDocId(
    this.route.snapshot.data['doc'],
  )
    ? (this.route.snapshot.data['doc'] as LegalDocId)
    : 'privacidad';

  protected readonly meta = LEGAL_DOCS[this.doc];

  constructor() {
    this.aplicarMetadatos();
  }

  private aplicarMetadatos(): void {
    this.title.setTitle(`${this.meta.title} · Kengo`);
    this.metaService.updateTag({
      name: 'description',
      content: this.meta.description,
    });
    // La copia canónica vive en la landing; esta no debe indexarse.
    this.metaService.updateTag({ name: 'robots', content: 'noindex, follow' });
    this.setCanonical(legalDocCanonicalUrl(this.doc));
  }

  private setCanonical(href: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /**
   * Volver sin dejar atrapado a quien llega por enlace directo (el caso del
   * revisor de la store, que abre la URL en frío y no tiene historial).
   */
  protected volver(): void {
    const win = this.document.defaultView;
    if (win && win.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/login']);
  }
}
