import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Ui2InputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [Ui2InputComponent, ReactiveFormsModule],
  template: `<ui2-input label="Email" type="email" [formControl]="control" [error]="error" />`,
})
class HostComponent {
  control = new FormControl<string | number | null>('inicial', { nonNullable: false });
  error: string | null = null;
}

@Component({
  standalone: true,
  imports: [Ui2InputComponent],
  template: `<ui2-input [type]="tipo" [spellcheck]="sc" />`,
})
class SpellcheckHostComponent {
  tipo: 'text' | 'email' | 'password' = 'email';
  sc: boolean | null = null;
}

/**
 * Intercepta el setter nativo de `value` del elemento para contar cuántas
 * veces se escribe el DOM. Es la garantía de que teclear no provoca una
 * reescritura programática (causa del flicker de la QuickType bar en iOS).
 */
function contarEscrituras(el: HTMLInputElement | HTMLTextAreaElement): () => number {
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

describe('Ui2InputComponent (CVA)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let inputEl: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    inputEl = fixture.nativeElement.querySelector('input');
  });

  it('pinta el valor inicial del control (writeValue antes del render)', () => {
    expect(inputEl.value).toBe('inicial');
  });

  it('teclear NO reescribe el value del DOM', () => {
    const escrituras = contarEscrituras(inputEl);
    inputEl.value = 'inicial x';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(escrituras()).toBe(1); // solo la asignación del propio test
    expect(host.control.value).toBe('inicial x');
  });

  it('setValue con el mismo valor que el DOM no escribe (guard de igualdad)', () => {
    const escrituras = contarEscrituras(inputEl);
    host.control.setValue('inicial');
    fixture.detectChanges();
    expect(escrituras()).toBe(0);
  });

  it('setValue programático sí actualiza el DOM', () => {
    host.control.setValue('nuevo@email.com');
    fixture.detectChanges();
    expect(inputEl.value).toBe('nuevo@email.com');
  });

  it('reset() deja el DOM vacío', () => {
    host.control.setValue('algo');
    host.control.reset();
    fixture.detectChanges();
    expect(inputEl.value).toBe('');
  });

  it('setValue(42) numérico se normaliza a string', () => {
    host.control.setValue(42);
    fixture.detectChanges();
    expect(inputEl.value).toBe('42');
  });

  it('control.disable() deshabilita el input', () => {
    host.control.disable();
    fixture.detectChanges();
    expect(inputEl.disabled).toBeTrue();
  });

  it('el mensaje de error se monta dentro de la zona de mensajes', () => {
    host.error = 'Email no válido';
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.ui2-input__msg-zone .ui2-input__msg--error');
    expect(msg?.textContent?.trim()).toBe('Email no válido');
  });
});

describe('Ui2InputComponent (spellcheck por defecto)', () => {
  let fixture: ComponentFixture<SpellcheckHostComponent>;
  let host: SpellcheckHostComponent;

  const inputEl = (): HTMLInputElement => fixture.nativeElement.querySelector('input');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SpellcheckHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(SpellcheckHostComponent);
    host = fixture.componentInstance;
  });

  it('emite spellcheck="false" para email y password', () => {
    host.tipo = 'email';
    fixture.detectChanges();
    expect(inputEl().getAttribute('spellcheck')).toBe('false');
    host.tipo = 'password';
    fixture.detectChanges();
    expect(inputEl().getAttribute('spellcheck')).toBe('false');
  });

  it('no emite el atributo para type text sin valor explícito', () => {
    host.tipo = 'text';
    fixture.detectChanges();
    expect(inputEl().hasAttribute('spellcheck')).toBeFalse();
  });

  it('el valor explícito del consumidor gana sobre el default', () => {
    host.tipo = 'email';
    host.sc = true;
    fixture.detectChanges();
    expect(inputEl().getAttribute('spellcheck')).toBe('true');
  });
});
