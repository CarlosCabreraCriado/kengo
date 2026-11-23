import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser, ViewportScroller } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '../../components/header/header.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { StatsComponent } from '../../components/stats/stats.component';
import { FeaturesComponent } from '../../components/features/features.component';
import { ClinicasComponent } from '../../components/clinicas/clinicas.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { PricingComponent } from '../../components/pricing/pricing.component';
import { TeamComponent } from '../../components/team/team.component';
import { FaqComponent } from '../../components/faq/faq.component';
import { DemoContactComponent } from '../../components/demo-contact/demo-contact.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { WhatsappFabComponent } from '../../components/whatsapp-fab/whatsapp-fab.component';
import { applyHomeSeo } from '../../shared/seo';

/**
 * Portada orientada a la clínica: qué gana → cómo funciona → cuánto cuesta →
 * quién está detrás → dudas → demo o «te llamamos».
 *
 * Todas las secciones se prerenderizan (llegan en el HTML, también las
 * anclas `#precios`, `#demo`, `#contacto`…); `@defer (hydrate …)` solo retrasa
 * la hidratación, no el contenido.
 */
@Component({
  selector: 'web-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HeaderComponent,
    HeroComponent,
    StatsComponent,
    FeaturesComponent,
    ClinicasComponent,
    HowItWorksComponent,
    PricingComponent,
    TeamComponent,
    FaqComponent,
    DemoContactComponent,
    FooterComponent,
    WhatsappFabComponent,
  ],
  template: `
    <web-header />
    <main>
      <web-hero />
      <web-stats />
      @defer (hydrate on idle) {
        <web-features />
      } @placeholder {
        <div style="min-height: 400px"></div>
      }
      @defer (hydrate on idle) {
        <web-clinicas />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (hydrate on idle) {
        <web-how-it-works />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (hydrate on viewport) {
        <web-pricing />
      } @placeholder {
        <div style="min-height: 400px"></div>
      }
      @defer (hydrate on viewport) {
        <web-team />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (hydrate on viewport) {
        <web-faq />
      } @placeholder {
        <div style="min-height: 300px"></div>
      }
      <!-- Sin @defer: el formulario tiene que responder en cuanto se llega
           por un enlace a #demo/#contacto, sin esperar a la hidratación. -->
      <web-demo-contact />
    </main>
    <web-footer />
    <web-whatsapp-fab />
  `,
})
export class HomeComponent {
  constructor() {
    applyHomeSeo();

    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    const document = inject(DOCUMENT);
    const scroller = inject(ViewportScroller);
    const destroyRef = inject(DestroyRef);
    let observer: MutationObserver | null = null;
    destroyRef.onDestroy(() => observer?.disconnect());

    // Al llegar a la home por navegación cliente (p. ej. «Precios» desde una
    // página legal), las secciones con @defer aún no están en el DOM cuando
    // el router intenta ir al ancla, así que se quedaba arriba del todo.
    // Si el ancla no existe todavía, esperamos a que aparezca (máx. 4 s).
    inject(ActivatedRoute)
      .fragment.pipe(takeUntilDestroyed())
      .subscribe((fragment) => {
        observer?.disconnect();
        if (!fragment || document.getElementById(fragment)) return;

        observer = new MutationObserver(() => {
          if (!document.getElementById(fragment)) return;
          observer?.disconnect();
          scroller.scrollToAnchor(fragment);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer?.disconnect(), 4000);
      });
  }
}
