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

// Se apunta si el gesto le dice al navegador "este movimiento es mío": sin
// eso, Safari se lo queda para desplazar y el swipe no llega a funcionar.
let vecesEvitado = 0;

/**
 * Reproduce un gesto de dedo con eventos táctiles, que es lo que manda un
 * iPhone de verdad. dx negativo = hacia la izquierda.
 */
async function deslizar(el, dx, { pasos = 6, ms = 120, dy = 0, destino = el } = {}) {
  const x0 = 200, y0 = 400;
  const toque = (x, y) => ({ clientX: x, clientY: y, identifier: 1, target: destino });
  const nuevo = (tipo, x, y, acabado = false) => {
    const e = new dom.window.Event(tipo, { bubbles: true, cancelable: tipo === 'touchmove' });
    const lista = [toque(x, y)];
    e.touches = acabado ? [] : lista;
    e.changedTouches = lista;
    e.targetTouches = acabado ? [] : lista;
    const original = e.preventDefault.bind(e);
    e.preventDefault = () => { vecesEvitado++; original(); };
    return e;
  };
  await act(async () => { destino.dispatchEvent(nuevo('touchstart', x0, y0)); });
  for (let i = 1; i <= pasos; i++) {
    const x = x0 + (dx * i) / pasos;
    const y = y0 + (dy * i) / pasos;
    await act(async () => { destino.dispatchEvent(nuevo('touchmove', x, y)); });
  }
  await new Promise((r) => setTimeout(r, ms));
  await act(async () => { destino.dispatchEvent(nuevo('touchend', x0 + dx, y0 + dy, true)); });
}

const zona = () => $('[style*="translateX"]') || $$('div').find((d) => d.style?.touchAction === 'pan-y');

// --- El gesto ---------------------------------------------------------------
console.log('\n--- Deslizar para cambiar de pregunta ---');
{
  const area = zona();
  ok('la zona del gesto existe', !!area);
  ok('deja el desplazamiento vertical al navegador', area.style.touchAction === 'pan-y');

  ok('empieza en la primera', T().includes('1 / 5'));

  vecesEvitado = 0;
  await deslizar(area, -150);
  ok('deslizar a la izquierda avanza', T().includes('2 / 5'));
  ok('le dice al navegador que el gesto es suyo', vecesEvitado > 0);

  // Y lo mismo si el dedo empieza encima de un botón de respuesta, que es lo
  // que pasa la mitad de las veces en una pantalla pequeña.
  const unaOpcion = $$('button').find((b) => b.querySelector('.rounded-md'));
  await deslizar(area, 150, { destino: unaOpcion });
  ok('funciona aunque el dedo empiece sobre una respuesta', T().includes('1 / 5'));
  await deslizar(area, -150);

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

// --- Barajar las opciones y reanudar ----------------------------------------
// El fallo que se vio en uso: parecía que "Barajar las opciones" no hacía
// nada. Y era peor: al continuar un test a medias, las respuestas ya dadas
// señalaban a otra opción, así que un acierto podía salir como fallo.
console.log('\n--- Barajar y reanudar ---');
{
  // banco.js usa import.meta.env, que sólo existe dentro de Vite. Se compila
  // igual que la app para poder usarlo aquí.
  const salidaBanco = path.join(cache, `banco-${process.pid}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(RAIZ, 'src', 'lib', 'banco.js')],
    bundle: true, format: 'esm',
    define: { 'import.meta.env': '{"BASE_URL":"/"}' },
    outfile: salidaBanco, logLevel: 'silent',
  });
  const { construirTest } = await import('file://' + salidaBanco);

  const original = {
    id: 'x-1', pregunta: '¿Cuál?', opciones: ['A', 'B', 'C', 'D'], correcta: 2,
    explicacion: 'e', ejemplo: 'j', revisado: true,
  };

  // Con 40 intentos, que salgan siempre en el mismo orden sería imposible.
  const ordenes = new Set();
  let correctaSiempreBien = true;
  for (let i = 0; i < 40; i++) {
    const [p] = construirTest([original], { cantidad: 'todas', aleatorio: false, barajarOpciones: true });
    ordenes.add(p.opciones.join(''));
    if (p.opciones[p.correcta] !== 'C') correctaSiempreBien = false;
  }
  ok('barajar cambia el orden de verdad', ordenes.size > 1);
  ok('y la correcta sigue apuntando a la misma respuesta', correctaSiempreBien);

  const [sinBarajar] = construirTest([original], { cantidad: 'todas', aleatorio: false, barajarOpciones: false });
  ok('con la opcion apagada no toca nada', sinBarajar.opciones.join('') === 'ABCD');

  // Lo que se guarda al hacer un test tiene que llevar el orden que ves.
  localStorage.clear();
  const barajada = construirTest([original], { cantidad: 'todas', aleatorio: false, barajarOpciones: true })[0];
  const raiz3 = document.createElement('div');
  document.body.appendChild(raiz3);
  const root3 = createRoot(raiz3);
  await act(async () => {
    root3.render(React.createElement(Test, {
      preguntas: [barajada], titulo: 'T', subtitulo: 's',
      ajustes: { avanceAutomatico: false }, alSalir: () => {}, alTerminar: () => {},
    }));
  });

  const guardada = JSON.parse(localStorage.getItem('ta_sesion') || '{}');
  ok('la sesion guarda el orden de las opciones', Array.isArray(guardada.orden));
  ok('con las opciones tal y como las ves',
     guardada.orden?.[0]?.opciones.join('') === barajada.opciones.join(''));
  ok('y con cual es la correcta en ese orden',
     guardada.orden?.[0]?.correcta === barajada.correcta);
  ok('sigue guardando los identificadores', guardada.ids?.[0] === 'x-1');

  await act(async () => { root3.unmount(); });
  raiz3.remove();
  localStorage.clear();
  fs.rmSync(salidaBanco, { force: true });
}

// --- El hueco de la barra de estado -----------------------------------------
console.log('\n--- Barra de estado del movil ---');
{
  const css = fs.readFileSync(path.join(RAIZ, 'src', 'index.css'), 'utf8');
  ok('hay una regla para apartar la barra de estado',
     /\.zonaSegura[^}]*safe-area-inset-top/s.test(css));

  const ui = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'ui.jsx'), 'utf8');
  ok('la cabecera la usa', /<header className="zonaSegura/.test(ui));

  const inicio = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'Inicio.jsx'), 'utf8');
  ok('y la pantalla de inicio tambien, que no lleva cabecera',
     /zonaSegura/.test(inicio));

  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  ok('el viewport permite dibujar bajo la barra', /viewport-fit=cover/.test(html));
}

// --- Ancho en el ordenador --------------------------------------------------
console.log('\n--- Aprovechar la pantalla del ordenador ---');
{
  const tarjeta = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'TarjetaPregunta.jsx'), 'utf8');
  ok('la tarjeta se parte en dos columnas al responder', /lg:grid-cols-2/.test(tarjeta));

  const inicio = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'Inicio.jsx'), 'utf8');
  ok('el menu de inicio va en rejilla', /md:grid-cols-2/.test(inicio));

  for (const archivo of ['Test.jsx', 'Estudio.jsx', 'Configurador.jsx', 'Estadisticas.jsx']) {
    const t = fs.readFileSync(path.join(RAIZ, 'src', 'components', archivo), 'utf8');
    ok(`${archivo} ya no se queda en una columna estrecha`,
       !/max-w-3xl/.test(t) && /max-w-5xl/.test(t));
  }
}

// --- El esquema en la app ---------------------------------------------------
console.log('\n--- El esquema en la tarjeta ---');
{
  const conEsquema = [{
    id: 'p-svg', pregunta: '¿Con dibujo?', opciones: ['A', 'B'], correcta: 0,
    explicacion: 'Porque sí.', ejemplo: 'Un ejemplo.', revisado: true,
    imagen: 'data/esquemas/p-svg.svg',
  }];
  const raiz4 = document.createElement('div');
  document.body.appendChild(raiz4);
  const root4 = createRoot(raiz4);
  await act(async () => {
    root4.render(React.createElement(Test, {
      preguntas: conEsquema, titulo: 'T', subtitulo: 's',
      ajustes: { avanceAutomatico: false }, alSalir: () => {}, alTerminar: () => {},
    }));
  });

  ok('antes de responder no se ve el esquema', !raiz4.querySelector('img'));

  const opcion = [...raiz4.querySelectorAll('button')].find((b) => b.querySelector('.rounded-md'));
  await act(async () => {
    opcion.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });

  const img = raiz4.querySelector('img');
  ok('al responder aparece el esquema', !!img);
  ok('apunta al archivo', img?.getAttribute('src')?.endsWith('data/esquemas/p-svg.svg'));
  ok('lleva la base de la app delante', img?.getAttribute('src')?.startsWith('/'));
  ok('tiene texto alternativo', !!img?.getAttribute('alt'));
  // El gesto de pasar de pregunta no debe dispararse al arrastrar sobre la
  // ilustración: si no, mirar un detalle te cambiaba de pregunta.
  ok('la ilustración no se lleva el gesto', !!img?.closest('[data-sin-swipe]'));
  // Retoque de modo oscuro sólo para las láminas sepia del propio programa.
  ok('a la lámina propia se le baja el brillo en oscuro',
     (img?.getAttribute('class') || '').includes('dark:brightness'));

  await act(async () => { root4.unmount(); });
  raiz4.remove();
}

// --- Ilustraciones puestas por el usuario en public/images ------------------
console.log('\n--- Ilustración de public/images ---');
{
  const conImagen = [{
    id: 'cfsd-0003', pregunta: '¿Con foto?', opciones: ['A', 'B'], correcta: 0,
    explicacion: 'Porque sí.', ejemplo: 'Un ejemplo.', revisado: true,
    imagen: 'images/cfsd-0003.png',
  }];
  const raiz5 = document.createElement('div');
  document.body.appendChild(raiz5);
  const root5 = createRoot(raiz5);
  await act(async () => {
    root5.render(React.createElement(Test, {
      preguntas: conImagen, titulo: 'T', subtitulo: 's',
      ajustes: { avanceAutomatico: false }, alSalir: () => {}, alTerminar: () => {},
    }));
  });

  const opcion5 = [...raiz5.querySelectorAll('button')].find((b) => b.querySelector('.rounded-md'));
  await act(async () => {
    opcion5.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });

  const foto = raiz5.querySelector('img');
  ok('se ve la imagen de public/images', !!foto);
  ok('apunta a images/', foto?.getAttribute('src')?.endsWith('images/cfsd-0003.png'));
  // Una foto o un dibujo a color del usuario se deja como su autor lo hizo.
  ok('a una imagen de fuera no se le toca el brillo',
     !(foto?.getAttribute('class') || '').includes('dark:brightness'));

  // Al tocarla se abre a pantalla completa: en el móvil el detalle no se ve.
  const lupa = foto?.closest('button');
  ok('la imagen es pulsable para ampliarla', !!lupa);
  await act(async () => {
    lupa.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  const grande = raiz5.querySelector('[role=dialog]');
  ok('al pulsarla se abre a pantalla completa', !!grande);
  ok('la vista grande tampoco se lleva el gesto', !!grande?.closest('[data-sin-swipe]'));
  await act(async () => {
    grande.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  ok('se cierra al tocar fuera', !raiz5.querySelector('[role=dialog]'));

  // Si el archivo falta, mejor no dejar el hueco del icono roto.
  await act(async () => {
    raiz5.querySelector('img').dispatchEvent(new dom.window.Event('error', { bubbles: false }));
  });
  ok('si la imagen no carga desaparece', !raiz5.querySelector('img'));

  await act(async () => { root5.unmount(); });
  raiz5.remove();
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
