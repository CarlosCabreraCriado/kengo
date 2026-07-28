import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { StatsComponent } from '../../components/stats/stats.component';
import { FeaturesComponent } from '../../components/features/features.component';
import { ClinicasComponent } from '../../components/clinicas/clinicas.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { TestimonialsComponent } from '../../components/testimonials/testimonials.component';
import { CtaComponent } from '../../components/cta/cta.component';
import { FooterComponent } from '../../components/footer/footer.component';

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
    TestimonialsComponent,
    CtaComponent,
    FooterComponent,
  ],
  template: `
    <web-header />
    <main>
      <web-hero />
      <web-stats />
      @defer (on idle) {
        <web-features />
      } @placeholder {
        <div style="min-height: 400px"></div>
      }
      @defer (on idle) {
        <web-clinicas />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on idle) {
        <web-how-it-works />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-testimonials />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-cta />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
    </main>
    <web-footer />
  `,
})
export class HomeComponent {}
