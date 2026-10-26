# Análisis del trabajo — Calculadora Next.js

- **Repositorio:** https://github.com/juanavilestech/Calculadora (público)
- **Ruta local:** `C:\Users\Juan\Proyectos\Calculadora`
- **Commit publicado:** `72686a0` — `Prueba de Nextjs con Opencode`
- **Fecha:** 25 de octubre de 2026

---

## 1. Resumen ejecutivo

Se construyó una calculadora web funcional con Next.js 16 (App Router), React 19, TypeScript y Tailwind CSS 4. La aplicación permite operaciones aritméticas básicas, decimales, porcentaje, cambio de signo, borrado, entrada por teclado y manejo de errores (división por cero). Se verificó con ESLint, compilación de producción, una petición HTTP real y 10 pruebas funcionales automatizadas en Edge headless mediante Playwright. El proyecto quedó publicado en GitHub.

El diseño sigue un patrón de **estado centralizado con reducer**, separación **Server/Client Components** y estilos utility-first. La modularización a nivel de proyecto es correcta (ruta, layout y componente interactivo separados), pero el componente principal concentra lógica, formateo, teclado y presentación en un solo archivo de 480 líneas, lo que constituye la principal deuda técnica.

---

## 2. Objetivo y alcance

**Solicitado:**
- Calculadora pequeña y funcional en Next.js.
- Carpeta llamada `Calculadora` dentro de `C:\Users\Juan\Proyectos`.
- Configuración TypeScript + Tailwind (elegida por el usuario).
- Publicación en GitHub con el commit `Prueba de Nextjs con Opencode`.

**Incluido:**
- Operaciones `+`, `−`, `×`, `÷`.
- Decimales con coma visible en español, agrupación de miles.
- `AC`, `±`, `%`, retroceso y `=`.
- Entrada por teclado físico.
- Manejo de división por cero y resultados no finitos.
- Diseño responsive, accesible y tema oscuro.

**Excluido (fuera de alcance):**
- Historial persistente, memoria, operaciones científicas.
- Backend, autenticación o base de datos.
- Despliegue en producción (solo repositorio).

---

## 3. Pasos realizados

### 3.1 Reconocimiento del entorno

Se verificaron versiones y restricciones antes de crear archivos:

```powershell
node -v          # v24.22.0
npm -v           # 11.19.1 (bloqueado inicialmente por ExecutionPolicy)
git --version    # 2.55.0
gh --version     # 2.102.0
gh auth status   # autenticado como juanavilestech
```

Hallazgos relevantes:
- `npm.ps1` no se podía ejecutar: la política efectiva era `Restricted`.
- Se usó temporalmente `cmd /c npm ...` como workaround.
- Posteriormente, a petición del usuario, se aplicó `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, que habilitó npm en PowerShell sin requerir administrador.
- La carpeta `C:\Users\Juan\Proyectos` no existía y se creó.
- El registro npm era accesible y la versión disponible de Next.js era `16.4.3`.

### 3.2 Creación del proyecto

Primer intento:

```powershell
npx create-next-app@latest Calculadora ...
```

Falló porque npm prohíbe mayúsculas en el nombre del paquete. Solución aplicada:

1. Crear el proyecto como `calculadora`.
2. Renombrar la carpeta con un paso intermedio (`calculadora_tmp` → `Calculadora`), porque Windows trata mayúsculas/minúsculas como el mismo nombre en una sola operación.

Comando efectivo:

```powershell
cmd /c "npx --yes create-next-app@latest calculadora --ts --tailwind --eslint --app --src-dir --import-alias @/* --use-npm --turbopack --yes"
```

Resultado: Next.js `16.4.3`, React `19.3.0`, Tailwind `4`, ESLint `9`, TypeScript `5`, alias `@/*`.

### 3.3 Revisión de documentación del framework

`create-next-app` generó un `AGENTS.md` que advierte que Next.js 16 tiene cambios respecto a versiones anteriores y pide leer la documentación local antes de escribir código. Se consultaron:

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

Esto confirmó el uso de Server Components por defecto y la necesidad de `"use client"` únicamente en el componente interactivo.

### 3.4 Implementación

Archivos escritos:

| Archivo | Propósito |
| --- | --- |
| `src/app/layout.tsx` | Layout raíz, fuentes, metadatos, `lang="es"` |
| `src/app/page.tsx` | Server Component: fondo, encabezado y montaje de la calculadora |
| `src/components/Calculator.tsx` | Client Component: estado, lógica, teclado y UI |
| `src/app/globals.css` | Tailwind, tokens de tema y tema oscuro |

Se mantuvo el andamiaje generado (configuración de Next, ESLint, TypeScript, `.gitignore`).

### 3.5 Verificación

```powershell
npm run lint     # sin errores
npm run build    # compilación de producción correcta, ruta / estática
```

Prueba en ejecución:

```powershell
npm run dev      # http://localhost:3000 -> HTTP 200
```

Pruebas funcionales automatizadas con `playwright-core` y Microsoft Edge headless (instalado fuera del proyecto, en un directorio temporal, para no agregar dependencias): se hicieron clics reales sobre los botones y se leyó el elemento `<output>`.

### 3.6 Publicación en GitHub

```powershell
git init -b main
git add -A
git commit -m "Prueba de Nextjs con Opencode"
gh repo create Calculadora --public --source=. --remote=origin --push
```

Resultado: repositorio público, rama `main` sincronizada con `origin/main`, árbol de trabajo limpio.

---

## 4. Arquitectura

### 4.1 Vista general

```
Navegador
  └── Next.js App Router
        └── src/app/layout.tsx        (Server Component)
              └── src/app/page.tsx    (Server Component)
                    └── <Calculator /> (Client Component, "use client")
                          ├── <CalcButton /> (presentacional)
                          └── lógica pura: reducer + formateadores
```

### 4.2 Frontera servidor/cliente

- `layout.tsx` y `page.tsx` permanecen como Server Components: no usan estado ni eventos, por lo que se prerenderizan estáticamente.
- `Calculator.tsx` es el único módulo cliente. Ahí viven `useReducer`, `useEffect` y los manejadores de eventos.
- Consecuencia: el bundle de JavaScript enviado al cliente se limita a la calculadora, no a toda la página.
- El build confirmó que la ruta `/` se genera como contenido estático (`○ Static`).

### 4.3 Flujo de datos

Arquitectura unidireccional:

```
Evento (clic o teclado)
  -> dispatch(action)
    -> reducer(state, action)
      -> nuevo estado inmutable
        -> React re-renderiza
          -> UI deriva display, tamaño y clases
```

No hay estado duplicado: la pantalla (`display`) y el tamaño de fuente se **derivan** de `entry` y `error`; no se almacenan por separado.

### 4.4 Modelo de estado

```ts
type State = {
  entry: string;              // entrada actual, sin formato (p. ej. "12.5")
  stored: number | null;      // acumulador
  operator: Operator | null;  // operación pendiente
  waiting: boolean;           // el próximo dígito inicia una nueva entrada
  expression: string;         // línea informativa de la operación
  error: boolean;             // bloqueo hasta AC
};
```

Las acciones son una unión discriminada (`digit`, `decimal`, `operator`, `equals`, `clear`, `sign`, `percent`, `backspace`), lo que permite exhaustividad comprobada por TypeScript.

---

## 5. Patrones de diseño

| Patrón | Dónde se aplica | Beneficio |
| --- | --- | --- |
| **Reducer / máquina de estados** | `reducer()` con `useReducer` | Transiciones explícitas y centralizadas; fácil de razonar y testear |
| **Acciones tipadas (union discriminada)** | `type Action` | Exhaustividad y autocompletado; errores en tiempo de compilación |
| **Funciones puras** | `compute`, `toEntry`, `formatEntry`, `formatNumber` | Determinismo, sin efectos secundarios, testeables de forma aislada |
| **Separación de responsabilidades** | Página (composición), componente (interacción), helpers (cálculo/formato) | Cambios localizados por capa |
| **Composición de componentes** | `Calculator` renderiza `CalcButton` | Reutilización de estilos y accesibilidad de botones |
| **Render derivado** | `display`, `displaySize`, clases condicionales | Evita estado redundante e inconsistencias |
| **Mapa de variantes** | `variantClasses: Record<ButtonVariant, string>` | Estilos consistentes sin cadenas condicionales dispersas |
| **Efecto aislado con limpieza** | `useEffect` para `keydown` | Evita fugas de listeners; `dispatch` es estable |
| **Estado de error pegajoso** | `error` solo se limpia con `AC` | Evita continuar operando sobre un resultado inválido |
| **Formateo independiente del locale** | Agrupación con regex en lugar de `Intl`/`toLocaleString` | Evita diferencias servidor/cliente e hidratación inconsistente |
| **Boundary Server/Client** | `"use client"` solo en el componente interactivo | Menor JavaScript enviado y mejor render inicial |

La evaluación aritmética es **secuencial** (estilo calculadora de bolsillo): `2 + 3 × 4 = 20`, no 14. Es una decisión consciente, no un error; se documenta como limitación si se esperara precedencia de operadores.

---

## 6. Modularización

### 6.1 Nivel de proyecto: adecuada

- Ruta (`app/`), componente de dominio (`components/`) y estilos globales están separados.
- Alias `@/*` evita rutas relativas frágiles.
- Configuración del framework aislada en `next.config.ts`, `eslint.config.mjs` y `tsconfig.json`.

### 6.2 Nivel de componente: mejorable

`Calculator.tsx` tiene 480 líneas y mezcla cinco responsabilidades:

1. Tipos y estado.
2. Reglas de negocio (reducer, cálculo, porcentaje).
3. Formateo numérico.
4. Mapeo de teclado físico.
5. Presentación (display, teclado, botones, textos).

Esto no impide que funcione, pero reduce la testeabilidad y aumenta el costo de cambio. Los formateadores y el reducer son puros y ya están listos para extraerse sin reescritura.

### 6.3 Refactor recomendado

```
src/
  features/calculator/
    calculator.types.ts      // State, Action, Operator
    calculator.reducer.ts    // reducer + initialState
    calculator.format.ts     // compute, toEntry, formatEntry
    Calculator.tsx           // solo composición y presentación
    CalculatorDisplay.tsx
    CalculatorKeypad.tsx
    CalculatorButton.tsx
    useCalculatorKeyboard.ts // efecto de teclado reutilizable
  app/
    page.tsx
    layout.tsx
```

Resultado esperado: `Calculator.tsx` por debajo de ~100 líneas, reducer y formateo cubiertos por pruebas unitarias, y teclado reutilizable en otras calculadoras o formularios.

---

## 7. Tecnologías utilizadas

| Tecnología | Versión | Uso |
| --- | --- | --- |
| Next.js | 16.4.3 | Framework, App Router, build y dev server |
| React | 19.3.0 | Componentes, `useReducer`, `useEffect` |
| TypeScript | ^5 | Tipado estricto (`strict: true`) |
| Tailwind CSS | ^4 | Estilos utility-first y tema oscuro |
| `@tailwindcss/turbopack` | ^4 | Integración de Tailwind con Turbopack |
| ESLint | ^9 + `eslint-config-next` 16.4.3 | Calidad estática |
| Turbopack | Incluido en Next 16 | Compilación y desarrollo |
| Node.js | 24.22.0 | Runtime |
| npm | 11.19.1 | Gestión de dependencias |
| Git | 2.55.0 | Control de versiones |
| GitHub CLI | 2.102.0 | Creación y publicación del repositorio |
| Playwright Core + Edge | Temporal, fuera del repo | Verificación funcional headless |

Configuración destacada de Next (`next.config.ts`): `cacheComponents: true`, `partialPrefetching: true` y regla de Turbopack para procesar CSS con `@tailwindcss/turbopack`.

---

## 8. Decisiones técnicas y justificación

| Decisión | Motivo |
| --- | --- |
| `useReducer` en vez de múltiples `useState` | Las transiciones dependen de varias variables; el reducer evita actualizaciones incoherentes y centraliza reglas |
| Entrada como `string` | Evita perder la coma decimal al escribir y permite controlar el límite de dígitos |
| Formateo manual (`.` de miles, `,` decimal) | Consistencia entre servidor y cliente; `toLocaleString` puede variar según el entorno y producir hidratación distinta |
| Límite de 12 dígitos | Evita desbordes visuales y resultados con precisión engañosa |
| Notación exponencial fuera de `[1e-9, 1e12)` | Mantiene legible la pantalla con números extremos |
| `waiting` para reiniciar entrada | Separa "estoy escribiendo" de "acabo de operar", sin duplicar estado |
| Error pegajoso hasta `AC` | Evita continuar con `NaN` o `Infinity` |
| Porcentaje relativo al acumulador | `200 + 10 %` calcula `200 + 20`, como calculadoras comunes |
| Teclado con `dispatch` estable | El efecto se registra una sola vez y no captura estado obsoleto |
| `aria-live` en `<output>` | Anuncia resultados a lectores de pantalla |
| Colores y foco visibles | Accesibilidad por teclado y contraste en tema oscuro |

---

## 9. Verificación y resultados

### 9.1 Comprobaciones estáticas

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | Sin errores |
| `npm run build` | Compilación exitosa; TypeScript sin errores |
| Generación estática | Ruta `/` prerenderizada |
| `GET http://localhost:3000` | HTTP 200, HTML contiene "Calculadora" y el botón `AC` |

### 9.2 Pruebas funcionales (Edge headless)

| Caso | Esperado | Obtenido |
| --- | --- | --- |
| `7 + 8 =` | `15` | `15` |
| `9 ÷ 0 =` | `Error` | `Error` |
| `AC` tras error | `0` | `0` |
| `1,5 × 2 =` | `3` | `3` |
| `50 %` | `0,5` | `0,5` |
| Teclado `12+3` + Enter | `15` | `15` |
| Retroceso sobre `123` | `12` | `12` |
| `5` + cambio de signo | `-5` | `-5` |
| `1234567` | `1.234.567` | `1.234.567` |
| `2+3*4 =` (evaluación secuencial) | `20` | `20` |

Además: cero errores en consola del navegador. No fue posible inspeccionar visualmente la captura de pantalla porque el modelo utilizado no admite entrada de imágenes; la verificación se basó en DOM, estilos calculados por el navegador y respuestas HTTP.

---

## 10. Calidad y accesibilidad

- Botones con `type="button"` y `aria-label` explícito (`Sumar`, `Dividir`, `Borrar todo`, etc.).
- `<output aria-live="polite" aria-atomic="true">` para resultados.
- Anillo de foco visible (`focus-visible:ring-*`) y navegación por teclado.
- Texto de ayuda con atajos.
- `lang="es"` en el documento.
- `select-none` en botones para evitar selección accidental al hacer clic repetido.
- Uso de `min-h-dvh` en lugar de `100vh` para móviles.
- Contraste alto sobre fondo oscuro y `color-scheme: dark`.

---

## 11. Limitaciones y riesgos

1. **Archivo monolítico:** `Calculator.tsx` concentra demasiadas responsabilidades (ver sección 6).
2. **Sin pruebas versionadas:** las pruebas funcionales se ejecutaron desde un directorio temporal y no quedaron en el repositorio.
3. **Sin CI/CD:** no hay workflow que ejecute lint, build y pruebas en cada push.
4. **Evaluación secuencial:** no respeta precedencia matemática; es intencional, pero debe conocerse.
5. **Sin historial ni memoria:** cada recarga reinicia el estado.
6. **Formato local fijo:** asume convención española (`.` miles, `,` decimal); no es configurable.
7. **Dependencia de Google Fonts en build:** `next/font/google` requiere red la primera vez; en entornos sin Internet podría fallar.
8. **Prueba visual no verificada por el modelo:** se compensó con pruebas de DOM y HTTP.
9. **`AGENTS.md` generado por Next:** se commiteó para mantener el árbol limpio, pero es un archivo de instrucciones para agentes, no documentación de usuario.

---

## 12. Mejoras recomendadas (priorizadas)

1. **Extraer el reducer y los formateadores** a `src/features/calculator/` y agregar pruebas unitarias con Vitest.
2. **Versionar pruebas E2E** con Playwright en el repositorio y un script `npm run test:e2e`.
3. **Agregar CI** (GitHub Actions): `npm ci`, `lint`, `build`, `test`.
4. **Desplegar en Vercel** o GitHub Pages (con adaptación si se usa export estático).
5. **Configurar formato regional** o al menos documentar la convención española.
6. **Ampliar funcionalidad:** historial de operaciones, memoria (`M+`, `MR`), raíz cuadrada, retroceso largo (mantener pulsado `AC`).
7. **Reemplazar el README genérico** por uno con captura, características, scripts y decisiones de diseño.
8. **Revisar el límite de 12 dígitos** según el caso de uso y valorar coma flotante decimal para precisión financiera.

---

## 13. Conclusión

El trabajo cumple el objetivo: una calculadora Next.js funcional, tipada, accesible, con buen comportamiento de borde (división por cero, límite de dígitos, formato) y verificada de extremo a extremo. La arquitectura aprovecha correctamente la separación servidor/cliente de Next.js y un reducer puro que facilita la evolución.

La principal oportunidad de mejora no está en la funcionalidad, sino en la **modularización interna** del componente y en **institucionalizar las pruebas** dentro del repositorio mediante CI. Con esas dos acciones, el proyecto pasaría de una demostración sólida a una base mantenible y escalable.
