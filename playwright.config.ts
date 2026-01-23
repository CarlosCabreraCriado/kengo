import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno de .env.e2e
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const STORAGE_STATE = path.join(__dirname, 'e2e/.auth/user.json');

// Configuración base (usada para auth y compartida)
const BASE_DEVICE = {
  ...devices['iPhone 15 Pro'],
};

// Desktop: solo cambia viewport, mantiene el resto igual para compatibilidad de cookies
const DESKTOP_DEVICE = {
  ...devices['iPhone 15 Pro'],
  viewport: { width: 1920, height: 1080 },
  isMobile: false,
  hasTouch: false,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60000,

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ==========================================
    // SETUP - Autenticación compartida
    // ==========================================
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...BASE_DEVICE,
      },
    },

    // ==========================================
    // MOBILE (iPhone 15 Pro - 393x852)
    // ==========================================
    {
      name: 'mobile-public',
      testMatch: /all-routes\.spec\.ts/,
      use: {
        ...BASE_DEVICE,
      },
      grep: /@public/,
      metadata: { deviceType: 'mobile' },
    },
    {
      name: 'mobile-protected',
      testMatch: /all-routes\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...BASE_DEVICE,
        storageState: STORAGE_STATE,
      },
      grep: /@protected/,
      metadata: { deviceType: 'mobile' },
    },

    // ==========================================
    // DESKTOP (1920x1080)
    // ==========================================
    {
      name: 'desktop-public',
      testMatch: /all-routes\.spec\.ts/,
      use: {
        ...DESKTOP_DEVICE,
      },
      grep: /@public/,
      metadata: { deviceType: 'desktop' },
    },
    {
      name: 'desktop-protected',
      testMatch: /all-routes\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...DESKTOP_DEVICE,
        storageState: STORAGE_STATE,
      },
      grep: /@protected/,
      metadata: { deviceType: 'desktop' },
    },
  ],

  // Web server: inicia la app Angular automáticamente
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
