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
    <!-- Global fixed background — equal to CTA aurora atmosphere -->
    <div class="global-bg" aria-hidden="true">
      <div class="gb-gradient"></div>
      <div class="gb-orb gb-orb-1"></div>
      <div class="gb-orb gb-orb-2"></div>
      <div class="gb-orb gb-orb-3"></div>
      <div class="gb-orb gb-orb-4"></div>
    </div>
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
  styles: [`
    /* ─── Global Fixed Background ─── */
    .global-bg {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
    }

    .gb-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        #fff 0%,
        #fffaf5 15%,
        #fff5eb 40%,
        #ffedde 70%,
        #ffe4d0 100%
      );
    }

    .gb-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
    }

    .gb-orb-1 {
      width: 700px;
      height: 700px;
      top: -10%;
      left: -15%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.28) 0%, transparent 70%);
      animation: gbFloat1 22s ease-in-out infinite;
    }

    .gb-orb-2 {
      width: 600px;
      height: 600px;
      top: 25%;
      right: -18%;
      background: radial-gradient(circle, rgba(239, 192, 72, 0.22) 0%, transparent 70%);
      animation: gbFloat2 28s ease-in-out infinite;
    }

    .gb-orb-3 {
      width: 500px;
      height: 500px;
      top: 55%;
      left: 15%;
      background: radial-gradient(circle, rgba(255, 180, 150, 0.2) 0%, transparent 70%);
      animation: gbFloat3 20s ease-in-out infinite;
    }

    .gb-orb-4 {
      width: 450px;
      height: 450px;
      bottom: 5%;
      right: 20%;
      background: radial-gradient(circle, rgba(231, 92, 62, 0.16) 0%, transparent 70%);
      animation: gbFloat4 25s ease-in-out infinite;
    }

    @keyframes gbFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(70px, 50px) scale(1.12); }
      66% { transform: translate(-40px, 70px) scale(1.06); }
    }

    @keyframes gbFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(-60px, -50px) scale(1.1); }
      66% { transform: translate(50px, -70px) scale(1.18); }
    }

    @keyframes gbFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-70px, 40px) scale(1.2); }
    }

    @keyframes gbFloat4 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(50px, -60px) scale(1.14); }
    }

    @media (prefers-reduced-motion: reduce) {
      .gb-orb { animation: none; }
    }
  `],
})
export class HomeComponent {}
