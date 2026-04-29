import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-actividad-shell',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './actividad-shell.component.html',
  styleUrl: './actividad-shell.component.css',
  host: {
    class: 'block w-full',
  },
})
export class ActividadShellComponent {}
