// Pruebas de la app de test, renderizándola de verdad en un navegador simulado.
// Uso:  node herramientas/probar-app.mjs      (requiere npm install)
//
// Compila src/App.jsx con esbuild, lo monta con React en jsdom y recorre el
// flujo completo: elegir módulo, responder, marcar, finalizar y ver resultados.

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

// --- Compilar la app a un módulo suelto ------------------------------------
// Se deja dentro del proyecto para que Node encuentre react en node_modules.
const cache = path.join(RAIZ, 'node_modules', '.cache');
fs.mkdirSync(cache, { recursive: true });
const salida = path.join(cache, `app-prueba-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(RAIZ, 'src', 'App.jsx')],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  define: { 'import.meta.env': '{"BASE_URL":"/"}' },
  outfile: salida,
  logLevel: 'silent',
});

// --- Montar el navegador simulado ------------------------------------------
const dom = new JSDOM(
  '<!doctype html><html class="dark"><head><meta name="theme-color" content="#000"></head><body><div id="root"></div></body></html>',
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
// Sin barajar opciones: así la pregunta 1 es siempre la misma y podemos fallarla a propósito.
dom.window.localStorage.setItem('ta_ajustes', JSON.stringify({ barajarOpciones: false }));

// fetch servido desde public/
global.fetch = async (url) => {
  const rel = String(url).replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '');
  const f = path.join(RAIZ, 'public', rel);
  if (!fs.existsSync(f)) return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) };
};
dom.window.fetch = global.fetch;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const App = (await import('file://' + salida)).default;

const root = createRoot(document.getElementById('root'));
await act(async () => { root.render(React.createElement(App)); });
await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

const fallos = [];
const T = () => document.body.textContent;
const btns = () => [...document.querySelectorAll('button')];
const buscar = (t) => btns().find((b) => b.textContent.includes(t));
const clic = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const opciones = () => btns().filter((b) => b.querySelector('.rounded-md'));
function ok(nombre, cond) {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
}

console.log('--- Inicio ---');
ok('titulo', T().includes('Test de Mecánica'));
ok('acciones principales', ['Nuevo test', 'Repasar fallos', 'Marcadas para después', 'Modo estudio', 'Estadísticas', 'Ajustes'].every((x) => T().includes(x)));
ok('repaso y marcadas empiezan desactivados', buscar('Repasar fallos').disabled && buscar('Marcadas para después').disabled);

console.log('--- Configurar test ---');
await clic(buscar('Nuevo test'));
ok('lista modulos con preguntas', T().includes('CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN'));
await clic(buscar('CIRCUITOS DE FLUIDOS'));
ok('opcion modulo completo', T().includes('Módulo completo'));
ok('submodulos reales del banco', ['RUEDAS', 'EL SISTEMA DE DIRECCIÓN'].every((x) => T().includes(x)));
ok('desactiva cantidades imposibles', btns().find((b) => b.textContent.trim() === '150')?.disabled === true);

console.log('--- Responder ---');
await clic(btns().find((b) => b.textContent.trim() === 'Del temario'));
await clic(btns().find((b) => b.textContent.trim() === 'Empezar test'));
ok('arranca en la primera', T().includes('1 / 10'));
ok('explicacion oculta antes de responder', !T().includes('Por qué'));
ok('cuatro opciones', opciones().length === 4);

const ops = opciones();
const iMal = ops.findIndex((o) => !o.textContent.includes('Frenar las oscilaciones'));
await clic(ops[iMal]);
ok('aparece la explicacion', T().includes('Por qué'));
ok('aparece el ejemplo', T().includes('Ejemplo'));
ok('la correcta en verde', !!document.querySelector('.border-emerald-500'));
ok('la fallada en rojo', !!document.querySelector('.border-rose-500'));
ok('no deja cambiar la respuesta', opciones().every((o) => o.disabled));
ok('registra el fallo', Object.values(JSON.parse(localStorage.getItem('ta_stats') || '{}'))[0]?.f === 1);
ok('guarda la sesion', !!localStorage.getItem('ta_sesion'));

console.log('--- Marcar y navegar ---');
await clic(document.querySelector('button[aria-label="Marcar para después"]'));
ok('marca la pregunta', JSON.parse(localStorage.getItem('ta_marcadas') || '[]').length === 1);
await clic(buscar('Siguiente'));
ok('avanza', T().includes('2 / 10'));
await clic(buscar('Anterior'));
ok('retrocede', T().includes('1 / 10'));

console.log('--- Indice y resultados ---');
await clic(document.querySelector('button[aria-label="Índice de preguntas"]'));
ok('el indice se abre con filtros', T().includes('Sin responder') && T().includes('Falladas'));
await clic(buscar('Finalizar test'));
ok('pantalla de resultado', T().includes('Resultado'));
ok('cuenta las no respondidas', T().includes('9 en blanco'));
ok('ofrece repetir fallos', T().includes('Repetir sólo los fallos'));
ok('guarda el historial', JSON.parse(localStorage.getItem('ta_historial') || '[]').length === 1);

console.log('--- Vuelta al inicio ---');
await clic(buscar('Volver al inicio'));
ok('repaso ya disponible', !buscar('Repasar fallos').disabled);
ok('marcadas ya disponible', !buscar('Marcadas para después').disabled);

console.log('--- Modo estudio ---');
await clic(buscar('Modo estudio'));
await clic(buscar('CIRCUITOS DE FLUIDOS'));
await clic(btns().find((b) => b.textContent.trim() === 'Empezar a estudiar'));
ok('muestra la explicacion sin responder', T().includes('Por qué') && T().includes('Ejemplo'));
ok('la correcta ya en verde', !!document.querySelector('.border-emerald-500'));

console.log('--- Estadisticas ---');
await clic(document.querySelector('button[aria-label="Volver"]'));
await clic(buscar('Estadísticas'));
ok('resumen por modulo e historial', T().includes('Por módulo') && T().includes('Historial'));

fs.rmSync(salida, { force: true });
console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
