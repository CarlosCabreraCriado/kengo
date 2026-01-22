import { Injectable, Type } from '@angular/core';
import { Router } from '@angular/router';
import { TarjetaClinicaComponent } from '../tarjeta-clinica/tarjeta-clinica.component';
import { TarjetaEjerciciosComponent } from '../tarjeta-ejercicios/tarjeta-ejercicios.component';
import { TarjetaPerfilComponent } from '../tarjeta-perfil/tarjeta-perfil.component';
import { TarjetaKengoComponent } from '../tarjeta-kengo/tarjeta-kengo.component';
import { TarjetaClientesComponent } from '../tarjeta-clientes/tarjeta-clientes.component';
import { TarjetaMaterialComponent } from '../tarjeta-material/tarjeta-material.component';
import { TarjetaCategoriasComponent } from '../tarjeta-categorias/tarjeta-categorias.component';

@Injectable({ providedIn: 'root' })
export class BentoService {
  constructor(private router: Router) {}

  getSlotsForRoute(route: string) {
    if (route.includes('inicio')) {
      return [
        {
          name: 'volver-inicio',
          colStart: 1,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 2,
        },
        {
          name: 'tarjeta-ejercicios',
          colStart: 3,
          rowStart: 1,
          colSpan: 4,
          rowSpan: 4,
        },
        {
          name: 'categorias',
          colStart: 3,
          rowStart: 5,
          colSpan: 2,
          rowSpan: 1,
        },
        {
          name: 'material',
          colStart: 5,
          rowStart: 5,
          colSpan: 2,
          rowSpan: 1,
        },
        {
          name: 'tarjeta-clinica',
          colStart: 7,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 2,
        },
        {
          name: 'tarjeta-perfil',
          colStart: 1,
          rowStart: 3,
          colSpan: 2,
          rowSpan: 3,
        },
        {
          name: 'tarjeta-clientes',
          colStart: 7,
          rowStart: 3,
          colSpan: 2,
          rowSpan: 3,
        },
      ];
    } else if (route.includes('clinica')) {
      return [
        {
          name: 'volver-inicio',
          colStart: 1,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 2,
        },
        {
          name: 'categorias',
          colStart: 3,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 1,
        },
        {
          name: 'categorias',
          colStart: 5,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 1,
        },
        {
          name: 'tarjeta-clinica',
          colStart: 7,
          rowStart: 1,
          colSpan: 2,
          rowSpan: 2,
        },
        {
          name: 'tarjeta-perfil',
          colStart: 1,
          rowStart: 3,
          colSpan: 2,
          rowSpan: 3,
        },
        {
          name: 'tarjeta-ejercicios',
          colStart: 3,
          rowStart: 2,
          colSpan: 4,
          rowSpan: 4,
        },
        {
          name: 'tarjeta-clientes',
          colStart: 7,
          rowStart: 3,
          colSpan: 2,
          rowSpan: 3,
        },
      ];
    }
    return [];
  }

  getComponentForSlot(slotName: string): Promise<Type<any> | null> {
    //const route = this.router.url;

    if (slotName === 'volver-inicio')
      return Promise.resolve(TarjetaKengoComponent);
    if (slotName === 'categorias')
      return Promise.resolve(TarjetaCategoriasComponent);
    if (slotName === 'material')
      return Promise.resolve(TarjetaMaterialComponent);
    if (slotName === 'tarjeta-ejercicios')
      return Promise.resolve(TarjetaEjerciciosComponent);
    if (slotName === 'tarjeta-perfil')
      return Promise.resolve(TarjetaPerfilComponent);
    if (slotName === 'tarjeta-clinica')
      return Promise.resolve(TarjetaClinicaComponent);
    if (slotName === 'tarjeta-clientes')
      return Promise.resolve(TarjetaClientesComponent);
    if (slotName === 'tarjeta-material')
      return Promise.resolve(TarjetaMaterialComponent);

    /*
    if (route.includes('inicio')) {
      if (slotName === 'volver-inicio')
        return Promise.resolve(TarjetaKengoComponent);
      if (slotName === 'categorias')
        return Promise.resolve(TarjetaCategoriasComponent);
      if (slotName === 'material')
        return Promise.resolve(TarjetaMaterialComponent);
      if (slotName === 'tarjeta-ejercicios')
        return Promise.resolve(TarjetaEjerciciosComponent);
      if (slotName === 'tarjeta-perfil')
        return Promise.resolve(TarjetaPerfilComponent);
      if (slotName === 'tarjeta-clinica')
        return Promise.resolve(TarjetaClinicaComponent);
      if (slotName === 'tarjeta-clientes')
        return Promise.resolve(TarjetaClientesComponent);
      if (slotName === 'tarjeta-material')
        return Promise.resolve(TarjetaMaterialComponent);
    } else if (route.includes('clinica')) {
      if (slotName === 'volver-inicio')
        return Promise.resolve(TarjetaEjerciciosComponent);
      if (slotName === 'categorias')
        return Promise.resolve(TarjetaEjerciciosComponent);
      if (slotName === 'tarjeta-ejercicios')
        return Promise.resolve(TarjetaEjerciciosComponent);
      if (slotName === 'tarjeta-perfil')
        return Promise.resolve(TarjetaEjerciciosComponent);
      if (slotName === 'tarjeta-clinica')
        return Promise.resolve(TarjetaEjerciciosComponent);
    }
    */
    return Promise.resolve(null);
  }
}
