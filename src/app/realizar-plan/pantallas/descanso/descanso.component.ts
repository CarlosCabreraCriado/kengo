import {
  Component,
  Output,
  EventEmitter,
  inject,
  computed,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroSesionService } from '../../../services/registro-sesion.service';
import { TemporizadorComponent } from '../../componentes/temporizador/temporizador.component';
import { fadeAnimation } from '../../realizar-plan.animations';

@Component({
  selector: 'app-descanso',
  standalone: true,
  imports: [CommonModule, TemporizadorComponent],
  animations: [fadeAnimation],
  template: `
    <div class="descanso-container">
      <div class="header-section" @fade>
        <h2 class="titulo">Descanso</h2>
        <p class="subtitulo">Prepárate para la siguiente serie</p>
      </div>

      <div class="timer-section">
        <app-temporizador
          #temporizador
          [tiempoInicial]="tiempoDescanso()"
          [autoIniciar]="true"
          label="segundos"
          [umbralAdvertencia]="5"
          (tiempoAgotado)="onTiempoAgotado()"
        />
      </div>

      <div class="info-section" @fade>
        <div class="proxima-serie">
          <span class="label">Próxima</span>
          <span class="valor">Serie {{ serieActual() }} de {{ totalSeries() }}</span>
        </div>
      </div>

      <div class="actions-section">
        <button
          type="button"
          class="btn-agregar"
          (click)="onAgregarTiempo()"
        >
          <span class="icon">+15</span>
          <span class="text">segundos</span>
        </button>

        <button
          type="button"
          class="btn-saltar"
          (click)="saltar.emit()"
        >
          Saltar descanso
          <span class="arrow">→</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    .descanso-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      gap: 32px;
      text-align: center;
    }

    .header-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .titulo {
      font-size: 2rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .subtitulo {
      font-size: 1rem;
      color: #6b7280;
      margin: 0;
    }

    .timer-section {
      padding: 16px 0;
    }

    .info-section {
      padding: 16px 0;
    }

    .proxima-serie {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px 32px;
      background: rgba(231, 92, 62, 0.1);
      border-radius: 12px;
    }

    .proxima-serie .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #9ca3af;
    }

    .proxima-serie .valor {
      font-size: 1.125rem;
      font-weight: 600;
      color: #e75c3e;
    }

    .actions-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      max-width: 280px;
    }

    .btn-agregar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 24px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      color: #374151;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-agregar:hover {
      border-color: #e75c3e;
      color: #e75c3e;
      background: rgba(231, 92, 62, 0.05);
    }

    .btn-agregar .icon {
      font-weight: 700;
      font-size: 1.125rem;
    }

    .btn-saltar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(231, 92, 62, 0.3);
    }

    .btn-saltar:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(231, 92, 62, 0.4);
    }

    .btn-saltar .arrow {
      transition: transform 0.2s ease;
    }

    .btn-saltar:hover .arrow {
      transform: translateX(4px);
    }
  `,
})
export class DescansoComponent implements OnInit {
  @Output() saltar = new EventEmitter<void>();
  @Output() tiempoAgotado = new EventEmitter<void>();
  @Output() agregarTiempo = new EventEmitter<number>();

  @ViewChild('temporizador') temporizador!: TemporizadorComponent;

  private registroService = inject(RegistroSesionService);

  readonly serieActual = this.registroService.serieActual;
  readonly totalSeries = this.registroService.totalSeries;
  readonly tiempoDescanso = computed(
    () => this.registroService.ejercicioActual()?.descanso_seg || 45
  );

  ngOnInit(): void {
    // El temporizador se inicia automáticamente
  }

  onTiempoAgotado(): void {
    // Vibrar si está disponible
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    this.tiempoAgotado.emit();
  }

  onAgregarTiempo(): void {
    if (this.temporizador) {
      this.temporizador.agregarTiempo(15);
    }
    this.agregarTiempo.emit(15);
  }
}
