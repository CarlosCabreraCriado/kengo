import { test, expect, TestInfo } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

// Obtener fecha actual en formato YYYY-MM-DD
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Obtener el tipo de dispositivo desde el proyecto
function getDeviceType(testInfo: TestInfo): 'mobile' | 'desktop' {
  const projectName = testInfo.project.name;
  if (projectName.includes('desktop')) {
    return 'desktop';
  }
  return 'mobile';
}

// Utilidad para capturar screenshot con espera de carga
async function captureScreenshot(
  page: any,
  testInfo: TestInfo,
  route: string,
  filename: string,
  authType: 'public' | 'protected'
) {
  const deviceType = getDeviceType(testInfo);
  const dateFolder = getCurrentDate();

  await page.goto(route);

  // Esperar a que la página cargue completamente
  await page.waitForLoadState('networkidle');

  // Esperar un poco más para animaciones
  await page.waitForTimeout(500);

  // Estructura: screenshots/{date}/{device}/{authType}/{filename}.png
  const screenshotPath = path.join(
    SCREENSHOTS_DIR,
    dateFolder,
    deviceType,
    authType,
    `${filename}.png`
  );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  console.log(`📸 [${dateFolder}/${deviceType}] ${filename}.png`);
}

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

test.describe('Rutas Públicas @public', () => {
  test('Login page', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/login', 'login', 'public');
    await expect(page.locator('form')).toBeVisible();
  });

  test('Registro page', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/registro', 'registro', 'public');
    await expect(page.locator('form')).toBeVisible();
  });
});

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

test.describe('Rutas Protegidas @protected', () => {
  test('Dashboard - Inicio', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/inicio', 'inicio', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Ejercicios - Lista', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/ejercicios', 'ejercicios', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Ejercicio - Detalle', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/ejercicios/11', 'ejercicio-detalle', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Categorías', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/categorias', 'categorias', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Mis Pacientes - Lista', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/mis-pacientes', 'mis-pacientes', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Planes - Lista', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/planes', 'planes', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Planes - Nuevo', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/planes/nuevo', 'planes-nuevo', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Mi Clínica', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/mi-clinica', 'mi-clinica', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Fisios', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/fisios', 'fisios', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Actividad Diaria', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/actividad-diaria', 'actividad-diaria', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Mi Plan', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/mi-plan', 'mi-plan', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('Perfil', async ({ page }, testInfo) => {
    await captureScreenshot(page, testInfo, '/perfil', 'perfil', 'protected');
    await expect(page).not.toHaveURL(/.*login/);
  });
});
