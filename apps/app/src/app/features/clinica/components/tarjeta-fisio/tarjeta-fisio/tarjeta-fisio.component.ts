import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Usuario } from '../../../../../types/global';
import { assetUrl } from '../../../../core/utils/asset-url';
import {
  Ui2CardComponent,
  Ui2AvatarComponent,
  Ui2PillComponent,
} from '../../../../shared/ui-v2';

/**
 * Tarjeta de fisio (V2 cream wellness) — usada en lista de equipo de la clínica.
 * Mantiene compatibilidad con el `input<Usuario | null>` original; cuando es null
 * muestra placeholders coherentes con el diseño.
 */
@Component({
  selector: 'app-tarjeta-fisio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Ui2CardComponent, Ui2AvatarComponent, Ui2PillComponent],
  templateUrl: './tarjeta-fisio.component.html',
  styleUrl: './tarjeta-fisio.component.css',
})
export class TarjetaFisioComponent {
  readonly fisio = input<Usuario | null>(null);

  readonly nombre = computed(() => {
    const f = this.fisio();
    if (!f) return 'Carlos Cabrera';
    return `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim() || 'Sin nombre';
  });

  readonly avatarUrl = computed<string | null>(() => {
    const f = this.fisio();
    if (!f?.avatar) return null;
    return `${assetUrl(f.avatar, { fit: 'cover', width: 128, height: 128 })}`;
  });

  readonly numeroColegiado = computed(() => this.fisio()?.numero_colegiado ?? null);
  readonly telefono = computed(() => this.fisio()?.telefono ?? null);
  readonly email = computed(() => this.fisio()?.email ?? null);
}
