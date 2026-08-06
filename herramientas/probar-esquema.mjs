// Pruebas de las láminas que acompañan a las explicaciones.
//   node herramientas/probar-esquema.mjs
//   node herramientas/probar-esquema.mjs --ver     (escribe una hoja de muestra)
//
// Lo importante que se comprueba aquí no es que el SVG "salga", sino tres
// cosas que se descubrieron mirando las láminas de verdad:
//
//  · Que NINGÚN rótulo se pise con otro. Con dieciséis láminas es imposible
//    verlo a ojo, y era el fallo que más ensuciaba el resultado.
//  · Que nada se salga del papel.
//  · Que la letra siga siendo legible cuando la lámina se encoge al ancho de
//    un móvil, que es donde se va a leer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGO, NOMBRES, construirDibujo } from './importador/dibujos.mjs';
import { instruccionLamina, mensajeLamina, leerEleccion } from './importador/esquema.mjs';
import { ANCHO, VISTAS } from './importador/lamina.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fallos = [];
const ok = (nombre, cond) => {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
};

// El ancho al que se ve la lámina en un iPhone corriente.
const ANCHO_MOVIL = 342;
const LETRA_MINIMA = 9;      // por debajo de esto no se lee

// --- Medir el texto ---------------------------------------------------------
//
// Se aproxima la caja de cada rótulo por el número de caracteres y el tamaño
// de letra. Hay que llevar una PILA de grupos: dentro del grupo del dibujo hay
// otros (las rotaciones de las ruedas) y sus cierres no deben cancelar el
// desplazamiento general.
const ANCHO_MEDIO = 0.52;

function cajasDeTexto(svg) {
  const cajas = [];
  const trozos = svg.split(/(<g[^>]*>|<\/g>)/);
  const pila = [];
  for (const trozo of trozos) {
    if (/^<g/.test(trozo)) {
      const m = trozo.match(/translate\(0 ([\d.]+)\)/);
      pila.push(m ? Number(m[1]) : 0);
      continue;
    }
    if (trozo === '</g>') { pila.pop(); continue; }
    const desplazamiento = pila.reduce((a, b) => a + b, 0);

    const re = /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
    for (const t of trozo.matchAll(re)) {
      const [, x, y, anclaje, tam, texto] = t;
      const limpio = texto.replace(/&[a-z]+;/g, 'x').trim();
      if (!limpio) continue;
      const w = limpio.length * Number(tam) * ANCHO_MEDIO;
      const h = Number(tam) * 1.15;
      const x0 = anclaje === 'middle' ? Number(x) - w / 2 : anclaje === 'end' ? Number(x) - w : Number(x);
      const yc = Number(y) + desplazamiento;
      cajas.push({ x0, x1: x0 + w, y0: yc - h * 0.78, y1: yc + h * 0.24, t: limpio, tam: Number(tam) });
    }
  }
  return cajas;
}

function solapes(svg, holgura = 1.5) {
  const c = cajasDeTexto(svg);
  const malos = [];
  for (let i = 0; i < c.length; i++) {
    for (let j = i + 1; j < c.length; j++) {
      const a = c[i], b = c[j];
      const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (dx > holgura && dy > holgura) malos.push(`"${a.t}" ⨯ "${b.t}"`);
    }
  }
  return malos;
}

function desbordes(svg) {
  const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  return cajasDeTexto(svg)
    .filter((c) => c.x0 < 4 || c.x1 > W - 4 || c.y0 < 2 || c.y1 > H - 2)
    .map((c) => `"${c.t}"`);
}

// --- Cada lámina ------------------------------------------------------------
console.log(`\n--- Las ${NOMBRES.length} láminas del cuaderno ---`);
for (const nombre of NOMBRES) {
  const svg = construirDibujo(nombre);
  if (!svg) { ok(`${nombre}: se genera`, false); continue; }

  const caja = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const [, W, H] = caja ? caja.map(Number) : [0, 0, 0];
  const tams = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  const enMovil = Math.min(...tams) * (ANCHO_MOVIL / W);

  const pisan = solapes(svg);
  const fuera = desbordes(svg);
  const etiquetas = svg.match(/<\/?[a-zA-Z]+/g) || [];
  const abiertas = etiquetas.filter((t) => !t.startsWith('</')).length;
  const cerradas = etiquetas.filter((t) => t.startsWith('</')).length;
  const autocierre = (svg.match(/\/>/g) || []).length;

  const bien = pisan.length === 0 && fuera.length === 0 &&
    abiertas - autocierre === cerradas && enMovil >= LETRA_MINIMA && W === ANCHO;
  ok(`${nombre.padEnd(24)} ${W}x${H}, letra mín ${enMovil.toFixed(1)}px en el móvil`, bien);
  if (pisan.length) console.log('         se pisan: ' + pisan.slice(0, 3).join(' · '));
  if (fuera.length) console.log('         se salen: ' + fuera.slice(0, 3).join(' · '));
}

// --- Lo que toda lámina tiene que traer -------------------------------------
console.log('\n--- Composición ---');
{
  const svg = construirDibujo(NOMBRES[0]);
  ok('lleva los ejes X, Y y Z', ['>X<', '>Y<', '>Z<'].every((e) => svg.includes(e)));
  ok('los ejes van arriba a la izquierda',
     /<text x="[2-5]\d" y="[1-4]\d"[^>]*>[XYZ]</.test(svg) || svg.indexOf('>X<') < svg.indexOf('</svg>') / 3);
  ok('el papel es de pergamino', svg.includes('#f2e8d5'));
  ok('el trazo tiembla como el de una mano', svg.includes('url(#pulso)'));
  ok('hay volumen', svg.includes('url(#vol-'));
  // Ningún texto puede pasar por el filtro de mano alzada: deformar un trazo
  // queda bien, deformar una letra la hace ilegible.
  // Se recorre con una pila de grupos: si aparece un <text> mientras hay un
  // grupo con el filtro abierto, esa letra saldría deformada.
  const letraDeformada = (t) => {
    let filtros = 0;
    for (const trozo of t.split(/(<g[^>]*>|<\/g>|<text)/)) {
      if (/^<g/.test(trozo)) { filtros += /filter="url\(#pulso\)"/.test(trozo) ? 1 : 0; continue; }
      if (trozo === '</g>') { filtros = Math.max(0, filtros - (filtros ? 0 : 0)); continue; }
    }
    // Recorrido con pila de verdad
    const pila = [];
    let mal = false;
    for (const trozo of t.split(/(<g[^>]*>|<\/g>|<text\b)/)) {
      if (/^<g/.test(trozo)) { pila.push(/filter="url\(#pulso\)"/.test(trozo)); continue; }
      if (trozo === '</g>') { pila.pop(); continue; }
      if (trozo === '<text' && pila.some(Boolean)) mal = true;
    }
    return mal;
  };
  ok('ninguna letra pasa por el filtro de mano alzada',
     NOMBRES.every((n) => !letraDeformada(construirDibujo(n))));

  // Las láminas de detalle no llevan ejes: ahí no significan nada.
  const detalle = NOMBRES.find((n) => CATALOGO[n].vista === 'detalle');
  if (detalle) {
    ok('un detalle no lleva ejes', !construirDibujo(detalle).includes('>Y<'));
  }
  ok('todas declaran una vista conocida',
     NOMBRES.every((n) => Object.prototype.hasOwnProperty.call(VISTAS, CATALOGO[n].vista)));
  ok('todas se describen para que el modelo pueda elegir',
     NOMBRES.every((n) => (CATALOGO[n].que || '').length > 30));
  ok('todas tienen título', NOMBRES.every((n) => !!CATALOGO[n].titulo));
}

// --- Casos que no dibujan ---------------------------------------------------
console.log('\n--- Cuando no hay lámina ---');
ok('una que no existe no dibuja', construirDibujo('bujia-de-precalentamiento') === null);
ok('sin nombre no dibuja', construirDibujo('') === null);
ok('con un título propio se cambia el del cuaderno',
   construirDibujo(NOMBRES[0], 'Otro título').includes('Otro título'));

// --- Texto peligroso --------------------------------------------------------
console.log('\n--- Texto que podría romper el archivo ---');
{
  const svg = construirDibujo(NOMBRES[0], 'Ángulo <caída> & "cero"');
  ok('escapa el menor que', svg.includes('&lt;'));
  ok('escapa el ampersand', svg.includes('&amp;'));
  ok('no cuela etiquetas inventadas', !svg.includes('<caída>'));
  ok('mantiene las tildes', svg.includes('Ángulo'));
}

// --- La elección del modelo -------------------------------------------------
console.log('\n--- Elegir lámina ---');
{
  const instruccion = instruccionLamina();
  ok('la instrucción enumera todas las láminas',
     NOMBRES.every((n) => instruccion.includes(n)));
  ok('deja decir que ninguna encaja', instruccion.includes('ninguna'));
  ok('avisa de no elegir por una palabra suelta', /palabra/i.test(instruccion));

  const primera = NOMBRES[0];
  ok('lee una elección limpia',
     leerEleccion(`{"lamina":"${primera}","titulo":""}`)?.lamina === primera);
  ok('lee una con markdown alrededor',
     leerEleccion('```json\n{"lamina":"' + primera + '"}\n```')?.lamina === primera);
  ok('lee una con cháchara delante',
     leerEleccion('Yo pondría esta: {"lamina":"' + primera + '"} ¿te vale?')?.lamina === primera);
  ok('lee una con razonamiento por medio',
     leerEleccion('<think>a ver</think>{"lamina":"' + primera + '"}')?.lamina === primera);

  ok('acepta que diga que ninguna', leerEleccion('{"lamina":"ninguna"}')?.lamina === 'ninguna');
  ok('rechaza una lámina inventada', leerEleccion('{"lamina":"motor-de-agua"}') === null);
  ok('rechaza lo que no es JSON', leerEleccion('Pues no sabría decirte.') === null);
  ok('rechaza un JSON roto', leerEleccion('{"lamina":') === null);
  ok('aguanta que no llegue nada', leerEleccion(null) === null);
  ok('recorta un título kilométrico',
     leerEleccion(JSON.stringify({ lamina: primera, titulo: 'x'.repeat(200) })).titulo.length <= 46);

  const m = mensajeLamina({
    pregunta: '¿Qué es la caída?', opciones: ['a', 'b'], correcta: 1,
    explicacion: 'Pues eso.', submodulo: 'RUEDAS',
  });
  ok('el mensaje lleva la pregunta', m.includes('¿Qué es la caída?'));
  ok('y la respuesta correcta, no la letra', m.includes('Respuesta correcta: b'));
  ok('y la explicación, de donde sale la elección', m.includes('Pues eso.'));
}

// --- Hoja de muestra --------------------------------------------------------
if (process.argv.includes('--ver')) {
  const destino = path.join(RAIZ, 'laminas-de-muestra.html');
  fs.writeFileSync(destino,
    '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' +
    '<title>Láminas</title><body style="background:#0b1220;color:#e8ddc8;font:15px/1.6 Georgia,serif;' +
    'padding:18px;max-width:420px;margin:auto">' +
    `<h1 style="font-size:19px;margin:0 0 4px">Láminas · ${NOMBRES.length} ilustraciones</h1>` +
    '<p style="color:#93a3bd;margin:0 0 18px;font-style:italic;font-size:13px">' +
    'Esta página mide 420 px a propósito: es lo que ocupa la lámina en un móvil.</p>' +
    NOMBRES.map((n) =>
      `<div style="margin-bottom:6px;border-radius:5px;overflow:hidden">${construirDibujo(n)}</div>` +
      `<p style="color:#5c6c85;font-size:11px;margin:0 0 24px;font-family:monospace">${n}</p>`
    ).join('') + '</body>');
  console.log('\nMuestra escrita en ' + destino);
}

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
