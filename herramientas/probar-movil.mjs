// Pruebas de lo que sólo falla en el móvil: el gesto de deslizar y poder
// salir del test cuando la cabecera ya no está a la vista.
//   node herramientas/probar-movil.mjs      (requiere npm install)
//
// El gesto se reproduce con la misma secuencia de eventos que manda un dedo:
// pointerdown, varios pointermove y pointerup. Así se comprueba de verdad, y
// no sólo que el código "parece" correcto.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM, esbuild;
try {
  ({ JSDOM } = await import('jsdom'));
  esbuild = await import('esbuild');
} catch (e) {
  console.log('Faltan dependencias. Ejecuta "npm install".\n' + e.message);
  process.exit(0);
}

const fallos = [];
const ok = (nombre, cond) => {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
};

// --- Montar el componente del test -----------------------------------------
const cache = path.join(RAIZ, 'node_modules', '.cache');
fs.mkdirSync(cache, { recursive: true });
const salida = path.join(cache, `movil-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(RAIZ, 'src', 'components', 'Test.jsx')],
  bundle: true, format: 'esm', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  define: { 'import.meta.env': '{"BASE_URL":"/"}' },
  outfile: salida, logLevel: 'silent',
});

const dom = new JSDOM(
  '<!doctype html><html class="dark"><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true }
);
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.localStorage = dom.window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom no implementa scrollTo y lo avisa en cada cambio de pregunta.
dom.window.scrollTo = () => {};

// jsdom no trae PointerEvent ni la captura de puntero. Se añaden mínimos, y de
// paso se apunta si el componente pide la captura: es justo lo que faltaba.
const capturas = [];
if (!dom.window.PointerEvent) {
  dom.window.PointerEvent = class PointerEvent extends dom.window.MouseEvent {
    constructor(tipo, opciones = {}) {
      super(tipo, opciones);
      this.pointerId = opciones.pointerId ?? 1;
      this.pointerType = opciones.pointerType ?? 'touch';
    }
  };
}
dom.window.Element.prototype.setPointerCapture = function (id) { capturas.push(id); };
dom.window.Element.prototype.releasePointerCapture = function () {};
dom.window.Element.prototype.hasPointerCapture = () => false;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const Test = (await import('file://' + salida)).default;

const preguntas = Array.from({ length: 5 }, (_, i) => ({
  id: `p-${i}`,
  pregunta: `Pregunta ${i + 1}?`,
  opciones: ['Una', 'Dos', 'Tres', 'Cuatro'],
  correcta: 1,
  explicacion: 'Una explicación larga que ocupa buena parte de la pantalla del móvil.',
  ejemplo: 'Un ejemplo.',
  revisado: true,
  submodulo: 'RUEDAS',
}));

let salido = false;
const root = createRoot(document.getElementById('root'));
await act(async () => {
  root.render(React.createElement(Test, {
    preguntas, titulo: 'Prueba', subtitulo: 'móvil',
    ajustes: { avanceAutomatico: false },
    alSalir: () => { salido = true; },
    alTerminar: () => {},
  }));
});

const T = () => document.body.textContent;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clic = async (el) => {
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
};

/** Reproduce un gesto de dedo sobre un elemento. dx negativo = hacia la izquierda. */
async function deslizar(el, dx, { pasos = 6, ms = 120, dy = 0 } = {}) {
  const x0 = 200, y0 = 400;
  const nuevo = (tipo, x, y) => new dom.window.PointerEvent(tipo, {
    bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0,
  });
  await act(async () => { el.dispatchEvent(nuevo('pointerdown', x0, y0)); });
  for (let i = 1; i <= pasos; i++) {
    const x = x0 + (dx * i) / pasos;
    const y = y0 + (dy * i) / pasos;
    await act(async () => { el.dispatchEvent(nuevo('pointermove', x, y)); });
  }
  await new Promise((r) => setTimeout(r, ms));
  await act(async () => { el.dispatchEvent(nuevo('pointerup', x0 + dx, y0 + dy)); });
}

const zona = () => $('[style*="translateX"]') || $$('div').find((d) => d.style?.touchAction === 'pan-y');

// --- El gesto ---------------------------------------------------------------
console.log('\n--- Deslizar para cambiar de pregunta ---');
{
  const area = zona();
  ok('la zona del gesto existe', !!area);
  ok('deja el desplazamiento vertical al navegador', area.style.touchAction === 'pan-y');

  ok('empieza en la primera', T().includes('1 / 5'));

  capturas.length = 0;
  await deslizar(area, -150);
  ok('deslizar a la izquierda avanza', T().includes('2 / 5'));
  ok('captura el puntero al reconocer el gesto', capturas.length > 0);

  await deslizar(area, 150);
  ok('deslizar a la derecha retrocede', T().includes('1 / 5'));

  // Un gesto corto pero rápido también cuenta: es como se pasa con el pulgar.
  await deslizar(area, -70, { pasos: 3, ms: 40 });
  ok('un golpe corto y rapido tambien pasa de pregunta', T().includes('2 / 5'));

  // Un roce mínimo no debe cambiar nada.
  await deslizar(area, -12, { pasos: 2, ms: 400 });
  ok('un roce pequeno no hace nada', T().includes('2 / 5'));

  // Desplazarse verticalmente para leer tampoco.
  await deslizar(area, -20, { dy: 160, pasos: 6, ms: 300 });
  ok('desplazarse hacia abajo no cambia de pregunta', T().includes('2 / 5'));

  // En el primero no se puede retroceder más.
  await deslizar(area, 200);
  await deslizar(area, 200);
  ok('no se sale por el principio', T().includes('1 / 5'));
}

// --- El gesto encima de la explicación --------------------------------------
console.log('\n--- Deslizar sobre la explicacion ---');
{
  // Se responde para que aparezca la explicación, que ocupa media pantalla.
  const opciones = $$('button').filter((b) => b.querySelector('.rounded-md'));
  await clic(opciones[0]);
  ok('aparece la explicacion', T().includes('Por qué'));

  const explicacion = $$('div').find((d) => /Por qué/.test(d.textContent) && d.className.includes('rounded-xl'));
  ok('la explicacion ya no bloquea el gesto',
     !explicacion?.closest('[data-sin-swipe]'));

  await deslizar(zona(), -150);
  ok('se puede pasar de pregunta desde la explicacion', T().includes('2 / 5'));
}

// --- Salir sin depender de la cabecera --------------------------------------
console.log('\n--- Salir del test ---');
{
  const barra = $('nav.fixed');
  ok('la barra de abajo esta fija', !!barra && barra.className.includes('bottom-0'));

  const salir = barra.querySelector('[aria-label="Salir al menú"]');
  ok('tiene el boton de salir', !!salir);
  const indice = barra.querySelector('[aria-label="Índice de preguntas"]');
  ok('y el del indice', !!indice);
  ok('siguen estando anterior y siguiente',
     !!barra.querySelector('[aria-label="Pregunta anterior"]') &&
     !!barra.querySelector('[aria-label="Pregunta siguiente"]'));

  await clic(salir);
  ok('pregunta antes de salir', T().includes('¿Salir del test?'));
  await clic($$('button').find((b) => b.textContent.includes('Guardar y salir')));
  ok('sale de verdad', salido === true);
}

// --- Lo mismo en el modo estudio --------------------------------------------
console.log('\n--- Modo estudio ---');
{
  const salidaEstudio = path.join(cache, `movil-estudio-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ, 'src', 'components', 'Estudio.jsx')],
    bundle: true, format: 'esm', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
    define: { 'import.meta.env': '{"BASE_URL":"/"}' },
    outfile: salidaEstudio, logLevel: 'silent',
  });
  const Estudio = (await import('file://' + salidaEstudio)).default;

  let salioEstudio = false;
  const raiz2 = document.createElement('div');
  document.body.appendChild(raiz2);
  const root2 = createRoot(raiz2);
  await act(async () => {
    root2.render(React.createElement(Estudio, {
      preguntas, titulo: 'Repaso', alSalir: () => { salioEstudio = true; },
    }));
  });

  const barra2 = [...raiz2.querySelectorAll('nav')].pop();
  const salir2 = barra2?.querySelector('[aria-label="Salir al menú"]');
  ok('el modo estudio tambien tiene salida abajo', !!salir2);
  await clic(salir2);
  ok('y funciona', salioEstudio === true);

  const zona2 = [...raiz2.querySelectorAll('div')].find((d) => d.style?.touchAction === 'pan-y');
  ok('tiene zona de gesto', !!zona2);
  await deslizar(zona2, -150);
  ok('deslizar avanza en estudio', raiz2.textContent.includes('2 / 5'));

  fs.rmSync(salidaEstudio, { force: true });
}

fs.rmSync(salida, { force: true });
console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
