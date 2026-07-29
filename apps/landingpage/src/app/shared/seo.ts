import { DOCUMENT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  /** Título de la pestaña. Se le añade el sufijo de marca. */
  title: string;
  description: string;
  /** URL absoluta y canónica de la página. */
  canonical: string;
}

const BRAND_SUFFIX = ' · Kengo';

/**
 * Ajusta las etiquetas de SEO de la página actual.
 *
 * El `index.html` de la landing trae el title, la description, el canonical y
 * el bloque Open Graph **hardcodeados con los valores de la home**. Este
 * helper los *sobrescribe* en lugar de añadir etiquetas nuevas: si no, cada
 * página legal compartiría el título y la tarjeta social de la portada.
 *
 * Debe llamarse desde el **constructor** del componente de ruta para que el
 * prerender (`outputMode: static`) capture los valores ya aplicados al
 * serializar el HTML.
 */
export function applySeo(data: SeoData): void {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);

  const fullTitle = `${data.title}${BRAND_SUFFIX}`;

  title.setTitle(fullTitle);
  meta.updateTag({ name: 'description', content: data.description });

  meta.updateTag({ property: 'og:title', content: fullTitle });
  meta.updateTag({ property: 'og:description', content: data.description });
  meta.updateTag({ property: 'og:url', content: data.canonical });
  meta.updateTag({ property: 'og:type', content: 'article' });

  meta.updateTag({ name: 'twitter:title', content: fullTitle });
  meta.updateTag({ name: 'twitter:description', content: data.description });

  const link =
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
    document.head.appendChild(
      Object.assign(document.createElement('link'), { rel: 'canonical' }),
    );
  link.setAttribute('href', data.canonical);

  // El `index.html` precarga la imagen del hero (el LCP de la portada). Como
  // el prerender parte de ese mismo HTML, las páginas que no son la home
  // acabarían descargando ~100 kB de AVIF que nunca se pintan. Solo la home
  // se salta este helper, así que aquí siempre sobra.
  document.head
    .querySelectorAll('link[rel="preload"][as="image"]')
    .forEach((el) => el.remove());
}
