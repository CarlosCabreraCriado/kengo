import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Ui2TextareaComponent } from './textarea.component';

@Component({
  standalone: true,
  imports: [Ui2TextareaComponent, ReactiveFormsModule],
  template: `<ui2-textarea label="Notas" [formControl]="control" [maxLength]="100" [showCount]="true" />`,
})
class HostComponent {
  control = new FormControl<string | null>('hola');
}

function contarEscrituras(el: HTMLTextAreaElement): () => number {
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

describe('Ui2TextareaComponent (CVA)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let textareaEl: HTMLTextAreaElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    textareaEl = fixture.nativeElement.querySelector('textarea');
  });

  it('pinta el valor inicial del control (writeValue antes del render)', () => {
    expect(textareaEl.value).toBe('hola');
  });

  it('teclear NO reescribe el value del DOM y el contador sigue el tecleo', () => {
    const escrituras = contarEscrituras(textareaEl);
    textareaEl.value = 'hola mundo';
    textareaEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(escrituras()).toBe(1); // solo la asignación del propio test
    expect(host.control.value).toBe('hola mundo');
    const count = fixture.nativeElement.querySelector('.ui2-textarea__count');
    expect(count?.textContent?.trim()).toBe('10/100');
  });

  it('setValue programático sí actualiza el DOM; reset lo vacía', () => {
    host.control.setValue('otro texto');
    fixture.detectChanges();
    expect(textareaEl.value).toBe('otro texto');
    host.control.reset();
    fixture.detectChanges();
    expect(textareaEl.value).toBe('');
  });
});
