import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }, testInfo) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL y E2E_USER_PASSWORD deben estar definidos en .env.e2e'
    );
  }

  console.log('🔐 Iniciando autenticación...');
  console.log(`📧 Email: ${email}`);

  // Navegar a la página de login
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Esperar al campo de email
  const emailInput = page.locator('input[formcontrolname="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });

  // Completar el email
  await emailInput.click();
  await emailInput.fill(email);
  await emailInput.blur();

  // Completar la contraseña
  const passwordInput = page.locator('input[formcontrolname="password"]');
  await passwordInput.click();
  await passwordInput.fill(password);
  await passwordInput.blur();

  // Dar tiempo para validación
  await page.waitForTimeout(500);

  // Hacer click en el botón
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // Esperar a que redirija a /inicio
  await page.waitForURL('**/inicio', { timeout: 20000 });
  console.log('✅ Login exitoso');

  // Verificar que estamos autenticados
  await expect(page).toHaveURL(/.*inicio/);

  // Guardar el estado de autenticación
  await page.context().storageState({ path: authFile });
  console.log(`✅ Sesión guardada en: ${authFile}`);
});
