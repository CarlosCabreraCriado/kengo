import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ui2PillComponent } from './pill.component';

@Component({
  standalone: true,
  imports: [Ui2PillComponent],
  template: `
    <ui2-pill [clickable]="true" icon="person">Ver ficha</ui2-pill>
    <ui2-pill icon="person">Paciente</ui2-pill>
  `,
})
class HostComponent {}

/**
 * Regresión: el template tenía un `<ng-content>` por rama del `@if`, y Angular
 * solo proyecta el contenido en un slot — la variante clicable se renderizaba
 * sin texto. Ver el `ng-template #cuerpo` de `pill.component.ts`.
 */
describe('Ui2PillComponent', () => {
  it('proyecta el contenido tanto en la variante clicable como en la estática', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const boton = el.querySelector('button.ui2-pill');
    expect(boton?.textContent).toContain('Ver ficha');

    const estatica = el.querySelector('span.ui2-pill');
    expect(estatica?.textContent).toContain('Paciente');
  });
});
