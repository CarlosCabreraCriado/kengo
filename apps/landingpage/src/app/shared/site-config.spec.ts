import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLANES } from '../../../../../convex/billing/_helpers';
import {
  NUM_FISIOS,
  PREFERENCIAS_CONTACTO as PREFERENCIAS_SERVIDOR,
} from '../../../../../convex/contact/_leadHelpers';
import { HOME_DESCRIPTION, HOME_TITLE } from './seo';
import {
  NUM_FISIOS_OPCIONES,
  OFERTA_FUNDADORA,
  PLANES_WEB,
  PREFERENCIAS_CONTACTO,
} from './site-config';

/**
 * La landing publica precios y envía leads a Convex. Estos tests atan los
 * datos de la web a sus fuentes de verdad en `convex/`: si alguien cambia una
 * tarifa o una lista del formulario en un lado y no en el otro, rompen aquí
 * en vez de publicar un precio falso o un formulario que siempre da 400.
 */
describe('site-config', () => {
  it('PLANES_WEB refleja exactamente PLANES de Convex', () => {
    expect(PLANES_WEB.length).toBe(PLANES.length);
    for (const web of PLANES_WEB) {
      const real = PLANES.find((p) => p.nombre === web.nombreInterno);
      expect(real).toBeDefined();
      expect(web.precioEur).toBe(real?.precioBaseEur);
      expect(web.precioIlimitadoEur).toBe(real?.precioIlimitadoEur);
      expect(web.limitePacientes).toBe(real?.limitePacientes);
      expect(web.fisiosMin).toBe(real?.rangoFisiosMin);
      expect(web.fisiosMax).toBe(real?.rangoFisiosMax);
    }
  });

  it('las listas del formulario coinciden con las que valida el servidor', () => {
    expect([...NUM_FISIOS_OPCIONES]).toEqual([...NUM_FISIOS]);
    expect(PREFERENCIAS_CONTACTO.map((p) => p.value)).toEqual([
      ...PREFERENCIAS_SERVIDOR,
    ]);
  });

  it('el JSON-LD de index.html anuncia el rango real de precios', () => {
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
    const precios = PLANES.flatMap((p) => [p.precioBaseEur, p.precioIlimitadoEur]);
    expect(html).toContain(`"lowPrice": "${Math.min(...precios)}"`);
    expect(html).toContain(`"highPrice": "${Math.max(...precios)}"`);
  });

  it('el SEO de la home coincide con el que trae index.html', () => {
    const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain(`<title>${HOME_TITLE}</title>`);
    expect(html).toContain(`name="description" content="${HOME_DESCRIPTION}"`);
  });

  it('la oferta fundadora es coherente', () => {
    expect(Number.isInteger(OFERTA_FUNDADORA.plazasRestantes)).toBe(true);
    expect(OFERTA_FUNDADORA.plazasRestantes).toBeGreaterThanOrEqual(0);
  });
});
