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
        <web-benefits class="relative z-10" />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
      @defer (on viewport) {
        <web-how-it-works class="relative z-10" />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }

      <!--
      @defer (on viewport) {
        <web-features class="relative z-10" />
      } @placeholder {
        <div style="min-height: 200px"></div>
      }
-->

      @defer (on viewport) {
        <web-testimonials class="relative z-10" />
      } @placeholder {
        <div style="min-height: 100px"></div>
      }

      @defer (on viewport) {
        <web-cta class="relative z-10" />
      } @placeholder {
        <div style="min-height: 100px"></div>
      }
    </main>
    <web-footer class="relative z-10" />
  `,
})
export class HomeComponent {}
