import { Component, OnInit } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { SlotComponent } from '../slot/slot.component';
import { BentoService } from '../services/bento.service';

@Component({
  selector: 'app-bento',
  standalone: true,
  imports: [SlotComponent],
  templateUrl: './bento.component.html',
  styleUrls: ['./bento.component.scss'],
  animations: [
    trigger('moveAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.9)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'scale(1)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate(
          '300ms ease-in',
          style({ transform: 'scale(0.9)', opacity: 0 }),
        ),
      ]),
    ]),
  ],
})
export class BentoComponent implements OnInit {
  slots: any[] = [];

  constructor(
    private bentoService: BentoService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadSlots();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.loadSlots();
      }
    });
  }

  loadSlots() {
    this.slots = this.bentoService.getSlotsForRoute(this.router.url);
  }
}
