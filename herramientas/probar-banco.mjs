// Pruebas de la pestaña Banco, montando la interfaz de verdad en un navegador
// simulado.  Uso:  node herramientas/probar-banco.mjs   (requiere npm install)
//
// Las pruebas de probar-panel.mjs comprueban la API; éstas comprueban lo que
// pasa al pulsar. Los fallos que salieron en uso real —el editor apareciendo
// al final de la página, no poder quitar una respuesta de más, y que escribir
// en una respuesta la marcara como correcta— eran todos de aquí.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch (e) {
  console.log('Faltan dependencias. Ejecuta "npm install".\n' + e.message);
  process.exit(0);
}

const fallos = [];
const ok = (nombre, cond) => {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Banco de mentira, con los casos que dan problemas ----------------------
const preguntaBase = (i, extra = {}) => ({
  id: `cfsd-000${i}`,
  idExterno: String(2778100 + i),
  moduloId: 'cfsd',
  modulo: 'CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN',
  submoduloId: 'sistemas-mecanicos',
  submodulo: 'SISTEMAS MECÁNICOS',
  pregunta: `Pregunta de prueba número ${i}?`,
  opciones: ['Primera', 'Segunda', 'Tercera', 'Cuarta'],
  correcta: 1,
  explicacion: 'Una explicación cualquiera.',
  ejemplo: 'Un ejemplo.',
  revisado: false,
  origen: `captura-${i}.png`,
  ...extra,
});

const PREGUNTAS = [
  preguntaBase(1),
  // La del problema: una respuesta de más.
  preguntaBase(2, { opciones: ['Una', 'Dos', 'Tres', 'Cuatro', 'Cinco de más'], correcta: 3 }),
  preguntaBase(3, { submodulo: 'Sin clasificar', submoduloId: 'sin-clasificar', explicacion: '' }),
];

const ESTADO = {
  banco: { total: 3, sinRevisar: 3, porModulo: [] },
  modulos: [{ id: 'cfsd', nombre: 'CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN',
              corto: 'Fluidos', color: '#38bdf8', submodulos: ['RUEDAS', 'SISTEMAS MECÁNICOS'] }],
  tesseract: { ok: true, idiomas: ['spa'] },
  macos: { ok: true },
  ollama: { ok: false, modelos: [] },
  git: { esRepo: false, cambios: 0, rama: null, remoto: null },
  ajustes: { motor: 'macos', modelo: 'gemma4:latest', modeloVision: 'gemma4:latest', carpetasRecientes: [] },
  dev: { activo: false, url: null },
  tarea: null,
  inicio: '/tmp',
};

// Lo que la interfaz le manda al servidor, para poder comprobarlo.
const enviados = [];

const html = fs.readFileSync(path.join(RAIZ, 'panel', 'ui.html'), 'utf8');

// El panel va en un <script type="module"> y el navegador simulado no ejecuta
// módulos. Se saca el código y se corre a mano; no importa nada de fuera, así
// que es exactamente el mismo que se ejecuta en el navegador de verdad.
const codigo = html.slice(
  html.indexOf('>', html.indexOf('<script type="module"')) + 1,
  html.lastIndexOf('</script>')
);
if (!codigo.trim()) { console.log('No se encuentra el código del panel'); process.exit(1); }
if (/^\s*(import|export)\s/m.test(codigo)) {
  console.log('El panel ahora importa módulos: hay que cambiar cómo lo monta esta prueba');
  process.exit(1);
}

const dom = new JSDOM(html, { url: 'http://localhost:5174/', runScripts: 'dangerously',
                              pretendToBeVisual: true, beforeParse(win) {
  win.fetch = async (url, opciones = {}) => {
    const ruta = String(url).replace('http://localhost:5174', '');
    if (opciones.body) enviados.push({ ruta, cuerpo: JSON.parse(opciones.body) });
    const responder = (datos) => ({ ok: true, status: 200, json: async () => datos, text: async () => html });
    if (ruta.startsWith('/api/estado')) return responder(ESTADO);
    if (ruta.startsWith('/api/preguntas')) return responder({ preguntas: PREGUNTAS });
    if (ruta.startsWith('/api/explorar')) {
      return responder({ ruta: '/tmp', padre: null, nivel: 'raiz', carpetas: [] });
    }
    if (ruta.startsWith('/api/actualizacion')) return responder({ hay: false });
    if (ruta === '/') return responder({});
    return responder({ ok: true });
  };
  win.confirm = () => true;
  win.alert = () => {};
  win.EventSource = class { constructor() {} close() {} addEventListener() {} };
} });

const { window } = dom;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => [...doc.querySelectorAll(s)];
const clic = (el) => el?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// Se envuelve en una función async porque el panel usa await en el nivel de
// arriba, que es legal en un módulo pero no en un script suelto.
dom.window.eval(`(async () => {\n${codigo}\n})()`);
await esperar(120);

// --- Se abre el Banco -------------------------------------------------------
console.log('\n--- Abrir el Banco ---');
clic($('nav button[data-v=banco]'));
await esperar(120);

ok('la vista del banco se muestra', $('#v-banco').hidden === false);
ok('el banco usa el ancho completo', doc.body.classList.contains('anchoBanco'));
ok('hay dos columnas', !!$('.banco2col .columnaLista') && !!$('.banco2col .columnaEditor'));
ok('el editor va antes del final de la pagina',
   $('.columnaEditor')?.closest('#v-banco') !== null);

const filas = () => $$('#listaPreguntas .pregFila');
ok('lista las tres preguntas', filas().length === 3);
ok('avisa de la que tiene una respuesta de mas',
   filas()[1].textContent.includes('sobra una'));
ok('avisa de la que no tiene tema', filas()[2].textContent.includes('sin tema'));

// --- Seleccionar y editar son cosas distintas -------------------------------
console.log('\n--- Seleccionar no es editar ---');
// Se pulsa la casilla tal cual: el navegador la marca solo antes de avisar.
const casilla = filas()[0].querySelector('[data-sel]');
clic(casilla);
await esperar(40);
ok('la casilla queda marcada', casilla.checked === true);
ok('marcar la casilla no abre el editor', !$('#editor').textContent.includes('Editar '));
ok('mientras tanto la columna derecha explica que hacer',
   $('#editor').textContent.includes('Pulsa una pregunta'));
ok('marcar la casilla cuenta como seleccion', /1 seleccionada/.test($('#infoSeleccion').textContent));
ok('se activan las acciones en bloque',
   !$('#btnBorrarSel').disabled && !$('#btnTemaSel').disabled && !$('#btnRevisarSel').disabled);

clic(filas()[0]);
await esperar(40);
ok('pulsar la fila abre el editor', $('#editor').innerHTML.includes('Editar cfsd-0001'));
ok('la fila abierta se distingue', filas()[0].classList.contains('abierta'));
ok('abrir el editor no cambia la seleccion', /1 seleccionada/.test($('#infoSeleccion').textContent));

// --- Escribir en una respuesta no cambia cuál es la correcta ----------------
console.log('\n--- Escribir no marca la correcta ---');
{
  const antes = $('#editor input[name=correcta]:checked').value;
  ok('arranca con la correcta que tenia guardada', antes === '1');

  const texto = $$('#editor .op .txt')[2];
  clic(texto);
  texto.textContent = 'Tercera, corregida';
  await esperar(40);
  const despues = $('#editor input[name=correcta]:checked').value;
  ok('pulsar el texto de otra respuesta no la marca como correcta', despues === '1');
  ok('el texto de la respuesta no esta dentro de un label',
     !$$('#editor .op .txt')[2].closest('label'));

  // Pero la letra sí sirve para marcarla, que es como se hace a propósito.
  const letra = $$('#editor .op .letra')[2];
  ok('la letra apunta a su casilla', letra.getAttribute('for') === 'opc-2');
  const radio = $('#opc-2');
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(20);
  ok('marcar por la letra si cambia la correcta',
     $('#editor input[name=correcta]:checked').value === '2');
}

// --- Quitar la respuesta que sobra ------------------------------------------
console.log('\n--- Quitar y anadir respuestas ---');
clic(filas()[1]);
await esperar(40);
ok('abre la de cinco respuestas', $('#editor').innerHTML.includes('Editar cfsd-0002'));
ok('avisa de que hay una de mas', $('#editor').textContent.includes('lo normal son 4'));
ok('hay una X en cada respuesta', $$('#editor [data-quitar]').length === 5);

clic($$('#editor [data-quitar]')[4]);
await esperar(40);
ok('quita la respuesta sobrante', $$('#editor .op').length === 4);
ok('las letras se renumeran', $$('#editor .op .letra')[3].textContent.startsWith('D'));
ok('no pierde el resto del texto',
   $$('#editor .op .txt').map((e) => e.textContent).join('|') === 'Una|Dos|Tres|Cuatro');
ok('la correcta sigue siendo la misma respuesta',
   $('#editor input[name=correcta]:checked').value === '3');

// Quitar la que estaba marcada como correcta no debe dejar una correcta falsa.
clic($$('#editor [data-quitar]')[3]);
await esperar(40);
ok('al quitar la correcta se queda en la primera',
   $('#editor input[name=correcta]:checked').value === '0');
ok('quedan tres respuestas', $$('#editor .op').length === 3);

clic($('#btnAnadirOpcion'));
await esperar(40);
ok('anade una respuesta vacia', $$('#editor .op').length === 4);
ok('la nueva esta vacia', $$('#editor .op .txt')[3].textContent === '');

// --- Guardar manda lo editado ----------------------------------------------
console.log('\n--- Guardar ---');
{
  enviados.length = 0;
  $$('#editor .op .txt')[3].textContent = 'Una respuesta nueva';
  clic($('#btnGuardarPregunta'));
  await esperar(60);
  const envio = enviados.find((e) => e.ruta.startsWith('/api/pregunta'));
  ok('manda la pregunta al servidor', !!envio);
  ok('manda las cuatro respuestas', envio?.cuerpo.opciones.length === 4);
  ok('incluye la que acabas de escribir',
     envio?.cuerpo.opciones.includes('Una respuesta nueva'));
  ok('no manda respuestas vacias', envio?.cuerpo.opciones.every((o) => o.length));
}

// --- Marcar revisadas en bloque --------------------------------------------
console.log('\n--- Marcar revisadas ---');
{
  enviados.length = 0;
  $('#selTodas').checked = true;
  $('#selTodas').dispatchEvent(new window.Event('change', { bubbles: true }));
  await esperar(40);
  ok('selecciona todas las visibles', /3 seleccionada/.test($('#infoSeleccion').textContent));

  clic($('#btnRevisarSel'));
  await esperar(60);
  const envio = enviados.find((e) => e.ruta.startsWith('/api/revisadas'));
  ok('llama a marcar revisadas', !!envio);
  ok('manda las tres', envio?.cuerpo.ids.length === 3);
}

// --- El asistente de la primera publicación ---------------------------------
console.log('\n--- Primera publicacion ---');
{
  // Carpeta sin repositorio: tiene que salir el paso 1, no un callejón sin salida.
  ESTADO.git = { esRepo: false, cambios: 0, rama: null, remoto: null,
                 identidad: null, gh: false, carpeta: 'test-automocion' };
  clic($('nav button[data-v=publicar]'));
  await esperar(80);
  ok('sale el asistente y no el boton de publicar', $('#cajaPrimeraVez').hidden === false);
  ok('la caja de publicar se esconde', $('#cajaPublicar').hidden === true);
  ok('empieza por preparar la carpeta', !!$('#btnGitInit'));
  ok('pide nombre y correo', !!$('#gitNombre') && !!$('#gitCorreo'));

  enviados.length = 0;
  clic($('#btnGitInit'));
  await esperar(60);
  ok('no deja seguir sin nombre ni correo',
     !enviados.some((e) => e.ruta.startsWith('/api/git-init')));

  $('#gitNombre').value = 'Carlos';
  $('#gitCorreo').value = 'carlos@ejemplo.com';
  clic($('#btnGitInit'));
  await esperar(60);
  const init = enviados.find((e) => e.ruta.startsWith('/api/git-init'));
  ok('manda preparar la carpeta', !!init);
  ok('con el nombre y el correo', init?.cuerpo.nombre === 'Carlos' && init?.cuerpo.correo === 'carlos@ejemplo.com');

  // Ya es repositorio pero sin GitHub: paso 2, a mano.
  ESTADO.git = { esRepo: true, cambios: 0, rama: 'main', remoto: null,
                 identidad: { nombre: 'Carlos', correo: 'carlos@ejemplo.com' },
                 gh: false, carpeta: 'test-automocion' };
  clic($('nav button[data-v=publicar]'));
  await esperar(80);
  ok('pasa a conectar con GitHub', !!$('#btnGitConectar'));
  ok('sin la herramienta de GitHub no ofrece crearlo solo', !$('#btnGhCrear'));
  ok('explica donde crear el repositorio', $('#pasosGit').innerHTML.includes('github.com/new'));

  enviados.length = 0;
  $('#gitUrl').value = 'https://github.com/carlos/test-automocion';
  clic($('#btnGitConectar'));
  await esperar(60);
  const conectar = enviados.find((e) => e.ruta.startsWith('/api/git-conectar'));
  ok('manda la direccion del repositorio',
     conectar?.cuerpo.url === 'https://github.com/carlos/test-automocion');

  // Con la herramienta de GitHub puede hacerlo todo solo.
  ESTADO.git.gh = true;
  clic($('nav button[data-v=publicar]'));
  await esperar(80);
  ok('con gh ofrece crear el repositorio', !!$('#btnGhCrear'));
  ok('sugiere el nombre de la carpeta', $('#ghNombre').value === 'test-automocion');

  enviados.length = 0;
  clic($('#btnGhCrear'));
  await esperar(60);
  const crear = enviados.find((e) => e.ruta.startsWith('/api/git-crear'));
  ok('manda crear el repositorio', !!crear);
  ok('privado por defecto', crear?.cuerpo.privado === true);

  // Y con todo enlazado, el asistente desaparece.
  ESTADO.git = { esRepo: true, cambios: 3, rama: 'main',
                 remoto: 'https://github.com/carlos/test-automocion',
                 identidad: { nombre: 'Carlos', correo: 'c@e.com' }, gh: true, carpeta: 'x' };
  clic($('nav button[data-v=publicar]'));
  await esperar(80);
  ok('con todo listo se esconde el asistente', $('#cajaPrimeraVez').hidden === true);
  ok('y se puede publicar', $('#btnPublicar').disabled === false);
  ok('dice cuantos archivos van', $('#estadoGit').textContent.includes('3 archivo'));
}

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
