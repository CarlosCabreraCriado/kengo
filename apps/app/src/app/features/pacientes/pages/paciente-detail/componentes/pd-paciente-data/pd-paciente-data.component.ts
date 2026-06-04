import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Usuario } from '../../../../../../../types/global';

export interface PdPacienteMeta {
  joined?: string | null;
  fisio?: string | null;
  clinica?: string | null;
}

@Component({
  selector: 'app-pd-paciente-data',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="pd-pdata">
      @if (paciente()?.email) {
        <div class="pd-pdata__row">
          <dt>Email</dt>
          <dd><a [href]="'mailto:' + paciente()!.email">{{ paciente()!.email }}</a></dd>
        </div>
      }
      @if (paciente()?.telefono) {
        <div class="pd-pdata__row">
          <dt>Teléfono</dt>
          <dd><a [href]="'tel:' + paciente()!.telefono">{{ paciente()!.telefono }}</a></dd>
        </div>
      }
      @if (meta()?.fisio) {
        <div class="pd-pdata__row">
          <dt>Fisio responsable</dt>
          <dd>{{ meta()!.fisio }}</dd>
        </div>
      }
      @if (meta()?.clinica) {
        <div class="pd-pdata__row">
          <dt>Clínica</dt>
          <dd>{{ meta()!.clinica }}</dd>
        </div>
      }
      @if (meta()?.joined) {
        <div class="pd-pdata__row">
          <dt>Desde</dt>
          <dd>{{ meta()!.joined }}</dd>
        </div>
      }
    </dl>
  `,
  styles: [
    `
      :host { display: block; }
      .pd-pdata {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .pd-pdata__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
      }
      .pd-pdata__row:last-child { border-bottom: 0; }
      dt {
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-500);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      dd {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-900);
        text-align: right;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      dd a { color: inherit; text-decoration: none; }
      dd a:hover { text-decoration: underline; }
    `,
  ],
})
export class PdPacienteDataComponent {
  readonly paciente = input<Usuario | null>(null);
  readonly meta = input<PdPacienteMeta | null>(null);
}
