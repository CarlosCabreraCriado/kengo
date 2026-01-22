import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
  keyframes,
  state,
} from '@angular/animations';

// Transición slide entre pantallas
export const slideAnimation = trigger('slide', [
  transition(':increment', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate(
      '300ms ease-out',
      style({ transform: 'translateX(0)', opacity: 1 })
    ),
  ]),
  transition(':decrement', [
    style({ transform: 'translateX(-100%)', opacity: 0 }),
    animate(
      '300ms ease-out',
      style({ transform: 'translateX(0)', opacity: 1 })
    ),
  ]),
]);

// Animación de checkmark al completar
export const checkmarkAnimation = trigger('checkmark', [
  transition(':enter', [
    style({ transform: 'scale(0)', opacity: 0 }),
    animate(
      '400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      style({ transform: 'scale(1)', opacity: 1 })
    ),
  ]),
]);

// Animación de pulso para botones
export const pulseAnimation = trigger('pulse', [
  state('idle', style({ transform: 'scale(1)' })),
  state('active', style({ transform: 'scale(1)' })),
  transition('idle => active', [
    animate(
      '200ms ease-in-out',
      keyframes([
        style({ transform: 'scale(1)', offset: 0 }),
        style({ transform: 'scale(1.05)', offset: 0.5 }),
        style({ transform: 'scale(1)', offset: 1 }),
      ])
    ),
  ]),
]);

// Fade in/out para elementos
export const fadeAnimation = trigger('fade', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)' }),
    animate(
      '200ms ease-out',
      style({ opacity: 1, transform: 'translateY(0)' })
    ),
  ]),
  transition(':leave', [
    animate(
      '150ms ease-in',
      style({ opacity: 0, transform: 'translateY(-10px)' })
    ),
  ]),
]);

// Animación de celebración para sesión completada
export const celebrateAnimation = trigger('celebrate', [
  transition(':enter', [
    style({ transform: 'scale(0) rotate(-180deg)', opacity: 0 }),
    animate(
      '600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      style({ transform: 'scale(1) rotate(0)', opacity: 1 })
    ),
  ]),
]);

// Stagger para listas de ejercicios
export const staggerAnimation = trigger('stagger', [
  transition(':enter', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        stagger(100, [
          animate(
            '300ms ease-out',
            style({ opacity: 1, transform: 'translateY(0)' })
          ),
        ]),
      ],
      { optional: true }
    ),
  ]),
]);

// Slide up para tarjetas
export const slideUpAnimation = trigger('slideUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(30px)' }),
    animate(
      '400ms ease-out',
      style({ opacity: 1, transform: 'translateY(0)' })
    ),
  ]),
]);
