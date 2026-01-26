import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'web-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class App {}
