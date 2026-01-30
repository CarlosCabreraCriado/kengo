# Optimización Bundle Size - Proyecto Kengo

## Resumen Ejecutivo

Análisis del proyecto Angular en `apps/app/` para identificar oportunidades de reducción del bundle size y mejora de rendimiento.

| Aspecto | Score | Estado |
|---------|-------|--------|
| Lazy Loading | 9/10 | Excelente |
| Tree Shaking | 8/10 | Bueno |
| Imports | 4/10 | **Crítico** |
| Assets | 3/10 | **Crítico** |
| Dependencias | 7/10 | Bueno |
| Servicios | 10/10 | Excelente |
| Change Detection | 2/10 | **Crítico** |

**Potencial de reducción estimado: 40-50%**

---

## 1. Assets Pesados (Impacto: -90% en assets)

### Problema
16.8MB en imágenes PNG sin optimizar en `/apps/app/src/assets/portadas/`:

| Archivo | Tamaño |
|---------|--------|
| `fisioterapeutas.png` | 2.3M |
| `camilla.PNG` | 2.0M |
| `fisioterapeutas-horizontal.png` | 1.7M |
| `planta-horizontal.png` | 1.6M |
| `calendario-horizontal.png` | 1.6M |
| `rutina-horizontal.png` | 1.5M |
| `progreso-horizontal.png` | 1.5M |
| `material.png` | 1.3M |
| `botella-horizontal.png` | 1.3M |

### Solución
Convertir a WebP (ya hay ejemplos: `ejercicios.webp` = 24K vs PNG ~256K).

**Ahorro estimado: 15MB → 1-2MB**

---

## 2. CommonModule Innecesario (Impacto: -5-8% bundle)

### Problema
43 componentes importan `CommonModule` completo cuando Angular 20 standalone permite imports específicos.

### Archivos afectados (ejemplos)
- `features/auth/pages/login/login.component.ts:11`
- `shared/ui/select/select.component.ts:14`
- `features/sesion/pages/realizar-plan/pantallas/feedback-final/feedback-final.component.ts:9`
- +40 más

### Solución
Reemplazar `CommonModule` por directivas específicas:
```typescript
// Antes
imports: [CommonModule]

// Después
imports: [NgIf, NgFor, NgClass] // solo las usadas
```

O mejor aún, usar `@if`, `@for`, `@switch` de Angular 17+ que no requieren imports.

---

## 3. Change Detection Strategy (Impacto: -10-15% rendering)

### Problema
0 componentes usan `ChangeDetectionStrategy.OnPush`. Todos usan Default, lo que causa re-renders innecesarios.

### Componentes prioritarios (por tamaño)
- `feedback-final.component.ts` - 1,274 líneas
- `ejercicio-activo.component.ts` - 1,129 líneas
- `plan-builder.component.ts` - 478 líneas

### Solución
Agregar a todos los componentes:
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

---

## 4. Barrel Files Afectando Tree Shaking (Impacto: -3-5%)

### Problema
`shared/index.ts` exporta 53+ items. Si un componente solo necesita `Button`, importa todo.

### Archivos afectados
- `apps/app/src/app/shared/index.ts` - 53+ exports
- `apps/app/src/app/features/pacientes/index.ts`
- `apps/app/src/app/core/index.ts`

### Solución
1. Importar directamente desde el archivo fuente cuando sea posible
2. O separar barrel files por dominio (ui/, services/, pipes/)

---

## 5. Dependencias de Terceros (Impacto: -2% bundle)

### Librerías que podrían lazy-loadear

| Librería | Tamaño | Uso actual |
|----------|--------|------------|
| `qrcode` | ~35KB | Solo en 2 componentes de diálogo |
| `ngx-image-cropper` | ~50KB | Solo en image-upload dialog |
| `@angular/cdk/drag-drop` | ~30KB | Solo en plan-builder |

### Solución
Cargar estas librerías dinámicamente solo cuando se necesiten:
```typescript
const QRCode = await import('qrcode');
```

---

## 6. Limpieza de Suscripciones (Impacto: rendimiento/memory)

### Problema
Solo 7 usos de `takeUntilDestroyed()` encontrados. Muchas suscripciones pueden tener memory leaks.

### Solución
Usar `takeUntilDestroyed()` en todas las suscripciones RxJS:
```typescript
private destroyRef = inject(DestroyRef);

this.service.getData()
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe();
```

---

## 7. Componentes Grandes que Requieren Refactor

### feedback-final.component.ts (1,274 líneas)
- Importa `CommonModule` y `FormsModule` innecesariamente
- Candidato a dividir en sub-componentes

### plan-builder.component.ts (478 líneas)
- Importa `DragDropModule` completo (podría ser standalone)
- Múltiples responsabilidades

---

## Lo que YA está bien

1. **Lazy Loading**: Todas las rutas usan `loadComponent()` o `loadChildren()`
2. **Servicios**: Todos usan `providedIn: 'root'` correctamente
3. **Signals**: Buen uso de Signals en lugar de OnInit/OnDestroy
4. **RxJS**: Imports específicos (`firstValueFrom`, no `*`)
5. **No side-effect imports** detectados

---

## Plan de Acción Recomendado

### Fase 1: Quick Wins (alto impacto, bajo esfuerzo)
1. [ ] Convertir PNG → WebP en `/assets/portadas/`
2. [ ] Reemplazar `CommonModule` por `@if`/`@for` en los 43 componentes

### Fase 2: Performance (medio esfuerzo)
3. [ ] Implementar `OnPush` en todos los componentes
4. [ ] Agregar `takeUntilDestroyed()` donde falte

### Fase 3: Bundle Optimization (más esfuerzo)
5. [ ] Lazy load de `qrcode` y `ngx-image-cropper`
6. [ ] Optimizar barrel files en `/shared`
7. [ ] Refactorizar componentes grandes (+500 líneas)

---

## Verificación

Para medir el impacto:
```bash
# Build de producción con análisis
npm run build -- --stats-json

# Analizar con source-map-explorer o webpack-bundle-analyzer
npx source-map-explorer dist/apps/app/browser/*.js
```
