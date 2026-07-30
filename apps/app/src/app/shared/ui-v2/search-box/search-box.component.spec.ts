import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Ui2SearchBoxComponent } from './search-box.component';

@Component({
  standalone: true,
  imports: [Ui2SearchBoxComponent, ReactiveFormsModule],
  template: `<ui2-search-box [formControl]="control" />`,
})
class HostConFormControlComponent {
  control = new FormControl<string | null>('');
}

@Component({
  standalone: true,
  imports: [Ui2SearchBoxComponent],
  template: `<ui2-search-box (valueChange)="ultimo = $event" />`,
})
class HostSinFormControlComponent {
  ultimo: string | null = null;
}

function contarEscrituras(el: HTMLInputElement): () => number {
  const proto = Object.getPrototypeOf(el) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc?.get || !desc.set) throw new Error('Descriptor de value no disponible');
  let escrituras = 0;
  Object.defineProperty(el, 'value', {
    configurable: true,
    get: () => desc.get!.call(el) as string,
    set: (v: string) => {
      escrituras++;
      desc.set!.call(el, v);
    },
  });
  return () => escrituras;
}

describe('Ui2SearchBoxComponent (CVA)', () => {
  describe('con formControl', () => {
    let fixture: ComponentFixture<HostConFormControlComponent>;
    let host: HostConFormControlComponent;
    let inputEl: HTMLInputElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HostConFormControlComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(HostConFormControlComponent);
      host = fixture.componentInstance;
      fixture.detectChanges();
      inputEl = fixture.nativeElement.querySelector('input');
    });

    it('teclear NO reescribe el value del DOM', () => {
      const escrituras = contarEscrituras(inputEl);
      inputEl.value = 'maría';
      inputEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(escrituras()).toBe(1); // solo la asignación del propio test
      expect(host.control.value).toBe('maría');
    });

    it('el botón de limpiar está siempre montado y se oculta sin valor', () => {
      const boton = fixture.nativeElement.querySelector('.ui2-search__clear');
      expect(boton).not.toBeNull();
      expect(boton.classList).toContain('ui2-search__clear--hidden');
      inputEl.value = 'x';
      inputEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(boton.classList).not.toContain('ui2-search__clear--hidden');
    });

    it('clear() vacía DOM y control', () => {
      host.control.setValue('algo');
      fixture.detectChanges();
      expect(inputEl.value).toBe('algo');
      const boton: HTMLButtonElement = fixture.nativeElement.querySelector('.ui2-search__clear');
      boton.click();
      fixture.detectChanges();
      expect(inputEl.value).toBe('');
      expect(host.control.value).toBe('');
    });
  });

  describe('sin formControl (solo valueChange)', () => {
    let fixture: ComponentFixture<HostSinFormControlComponent>;
    let host: HostSinFormControlComponent;
    let inputEl: HTMLInputElement;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HostSinFormControlComponent],
      }).compileComponents();
      fixture = TestBed.createComponent(HostSinFormControlComponent);
      host = fixture.componentInstance;
      fixture.detectChanges();
      inputEl = fixture.nativeElement.querySelector('input');
    });

    it('emite valueChange al teclear y clear() vacía el DOM', () => {
      inputEl.value = 'rodilla';
      inputEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(host.ultimo).toBe('rodilla');

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector('.ui2-search__clear');
      boton.click();
      fixture.detectChanges();
      expect(inputEl.value).toBe('');
      expect(host.ultimo).toBe('');
    });
  });
});
