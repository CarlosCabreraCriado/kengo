import { Component, OnInit } from '@angular/core';

import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { filter } from 'rxjs/operators';
import { CarritoEjerciciosComponent } from './carrito-ejercicios/carrito-ejercicios.component';

import {
  RouterOutlet,
  Router,
  NavigationCancel,
  NavigationEnd,
} from '@angular/router';

//Servicios:
import { AppService } from './services/app.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CarritoEjerciciosComponent
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'kengo';

  private location: string | null = null;
  public activarHeader = false;

  constructor(
    public router: Router,
    private appService: AppService,
  ) {}

  ngOnInit() {
    this.recallJsFuntions();
    this.appService.inicializarApp();
  }

  recallJsFuntions() {
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd || event instanceof NavigationCancel,
        ),
      )
      .subscribe((event) => {
        this.location = this.router.url;
        if (this.location == '/login' || this.location == '/register') {
          this.activarHeader = false;
        } else {
          this.activarHeader = true;
        }

        if (!(event instanceof NavigationEnd)) {
          return;
        }

        //window.scrollTo(0, 0);
      });
  }
}
