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
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .descanso-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      min-height: 0;
      gap: 20px;
      text-align: center;
      padding: 16px 0;
      overflow: hidden;
    }

    .header-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .titulo {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .subtitulo {
      font-size: 0.9375rem;
      color: #6b7280;
      margin: 0;
      font-weight: 500;
    }

    .timer-section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    .info-section {
      flex-shrink: 0;
    }

    .proxima-serie {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 18px 36px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow:
        0 4px 20px rgba(231, 92, 62, 0.1),
        inset 0 0 0 1px rgba(231, 92, 62, 0.15);
      transition: all 0.3s ease;
    }

    .proxima-serie:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 28px rgba(231, 92, 62, 0.15),
        inset 0 0 0 1px rgba(231, 92, 62, 0.2);
    }

    .proxima-serie .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #9ca3af;
      font-weight: 600;
    }

    .proxima-serie .valor {
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .actions-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
      max-width: 300px;
      flex-shrink: 0;
    }

    .btn-agregar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 24px;
      border: none;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #374151;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.06),
        inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    }

    .btn-agregar:hover {
      background: rgba(231, 92, 62, 0.1);
      color: #e75c3e;
      transform: translateY(-2px);
      box-shadow:
        0 8px 24px rgba(231, 92, 62, 0.12),
        inset 0 0 0 1px rgba(231, 92, 62, 0.3);
    }

    .btn-agregar:active {
      transform: translateY(-1px);
    }

    .btn-agregar .icon {
      font-weight: 800;
      font-size: 1.25rem;
    }

    .btn-saltar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px 28px;
      border: none;
      border-radius: 16px;
      background: linear-gradient(135deg, #e75c3e 0%, #d14d31 100%);
      color: white;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 28px rgba(231, 92, 62, 0.35);
    }

    .btn-saltar:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 36px rgba(231, 92, 62, 0.45);
    }

    .btn-saltar:active {
      transform: translateY(-1px);
    }

    .btn-saltar .arrow {
      font-size: 1.25rem;
      transition: transform 0.3s ease;
    }

    .btn-saltar:hover .arrow {
      transform: translateX(6px);
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
