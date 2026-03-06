import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { FeaturesComponent } from '../../components/features/features.component';
import { TestimonialsComponent } from '../../components/testimonials/testimonials.component';
import { CtaComponent } from '../../components/cta/cta.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'web-home',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    HeroComponent,
    BenefitsComponent,
    HowItWorksComponent,
    FeaturesComponent,
    TestimonialsComponent,
    CtaComponent,
    FooterComponent,
  ],
  template: `
    <web-header />
    <main>
      <web-hero />
      @defer (on viewport) {
        <web-benefits />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-how-it-works />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-features />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-testimonials />
      } @placeholder {
        <div style="min-height: 100px"></div>
      }
      @defer (on viewport) {
        <web-cta />
      } @placeholder {
        <div style="min-height: 100px"></div>
      }
    </main>
    <web-footer />
  `,
})
export class HomeComponent {}
