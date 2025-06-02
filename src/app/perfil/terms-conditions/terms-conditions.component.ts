import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-terms-conditions',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './terms-conditions.component.html',
  styleUrl: './terms-conditions.component.scss',
})
export class TermsConditionsComponent {}
