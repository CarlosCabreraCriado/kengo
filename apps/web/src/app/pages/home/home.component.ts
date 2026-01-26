import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { BenefitsComponent } from '../../components/benefits/benefits.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { FeaturesComponent } from '../../components/features/features.component';
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
    CtaComponent,
    FooterComponent,
  ],
  template: `
    <web-header />
    <main>
      <web-hero />
      <web-benefits />
      <web-how-it-works />
      <web-features />
      <web-cta />
    </main>
    <web-footer />
  `,
})
export class HomeComponent {}
