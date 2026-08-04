// Pruebas del lector de macOS (framework Vision).
// Uso:  node herramientas/probar-macos.mjs
//
// El programa que habla con Vision está en Swift y sólo se puede ejecutar en un
// Mac, así que aquí se comprueba todo lo que sí es comprobable en cualquier
// sitio: la conversión de coordenadas, la forma de las líneas, la detección de
// si el equipo puede usarlo, y que la fórmula del Swift sigue siendo la misma
// que la del espejo en JavaScript.

import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lineasDesdeJson, aPixeles, comprobarMacOS } from './importador/ocr-macos.mjs';
import { extraerPregunta, completa } from './importador/parseo.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const SWIFT = AQUI + 'importador/ocr-macos.swift';

const fallos = [];
const ok = (nombre, condicion) => {
  console.log(`${condicion ? '  ok  ' : ' FALLA'} ${nombre}`);
  if (!condicion) fallos.push(nombre);
};

// --- Conversión de coordenadas ---------------------------------------------
// Vision numera de 0 a 1 y cuenta desde ABAJO. El importador cuenta píxeles
// desde ARRIBA. Si esto se invierte, la banda verde deja de cuadrar con el
// texto y todo lo demás falla en cascada sin dar la cara.
console.log('\n--- Coordenadas ---');
{
  const ancho = 1000, alto = 800;

  // Una caja pegada al borde de arriba en la pantalla: en Vision su maxY vale 1.
  const arribaDeTodo = aPixeles({ minX: 0, maxX: 1, minY: 0.9, maxY: 1 }, ancho, alto);
  ok('el borde superior queda en 0', arribaDeTodo.arriba === 0);
  ok('mantiene el alto de la caja', arribaDeTodo.abajo === 80);

  // Una caja pegada al borde de abajo: en Vision su minY vale 0.
  const abajoDeTodo = aPixeles({ minX: 0, maxX: 1, minY: 0, maxY: 0.1 }, ancho, alto);
  ok('el borde inferior queda en el alto total', abajoDeTodo.abajo === 800);
  ok('arriba nunca es mayor que abajo', abajoDeTodo.arriba < abajoDeTodo.abajo);

  const centro = aPixeles({ minX: 0.25, maxX: 0.75, minY: 0.45, maxY: 0.55 }, ancho, alto);
  ok('la horizontal no se toca', centro.izquierda === 250 && centro.derecha === 750);
  ok('el centro se queda en el centro', centro.arriba === 360 && centro.abajo === 440);

  // Dos líneas seguidas: la que está más arriba en la pantalla tiene la Y de
  // Vision más ALTA. Es justo al revés de lo que uno esperaría.
  const primera = aPixeles({ minX: 0.1, maxX: 0.9, minY: 0.80, maxY: 0.86 }, ancho, alto);
  const segunda = aPixeles({ minX: 0.1, maxX: 0.9, minY: 0.70, maxY: 0.76 }, ancho, alto);
  ok('respeta el orden de lectura', primera.arriba < segunda.arriba);
}

// --- El Swift y el espejo dicen lo mismo ------------------------------------
console.log('\n--- El programa Swift ---');
{
  const codigo = fs.existsSync(SWIFT) ? fs.readFileSync(SWIFT, 'utf8') : '';
  ok('existe ocr-macos.swift', !!codigo);
  ok('le da la vuelta al eje vertical', codigo.includes('(1 - caja.maxY)') && codigo.includes('(1 - caja.minY)'));
  ok('multiplica por el tamano real', codigo.includes('caja.minX * ancho') && codigo.includes('caja.maxX * ancho'));
  ok('pide el nivel preciso', codigo.includes('.accurate'));
  ok('lee en espanol', codigo.includes('es-ES'));
  ok('devuelve las claves que espera el importador',
    ['"texto"', '"izquierda"', '"derecha"', '"arriba"', '"abajo"', '"conf"'].every((k) => codigo.includes(k)));
}

// --- Lectura de la respuesta ------------------------------------------------
console.log('\n--- Respuesta del lector ---');
{
  const crudo = {
    ancho: 900, alto: 600,
    lineas: [
      { texto: '  C) El par motor  ', arriba: 300, abajo: 322, izquierda: 60, derecha: 400, conf: 97 },
      { texto: 'PREGUNTA:', arriba: 100, abajo: 124, izquierda: 60, derecha: 200, conf: 99 },
      { texto: '   ', arriba: 500, abajo: 520, izquierda: 60, derecha: 90, conf: 40 },
      { texto: 'sin sitio', arriba: null, abajo: 20, izquierda: 1, derecha: 2, conf: 10 },
    ],
  };
  const lineas = lineasDesdeJson(crudo);
  ok('descarta las lineas vacias y las que no tienen sitio', lineas.length === 2);
  ok('ordena de arriba abajo', lineas[0].texto === 'PREGUNTA:');
  ok('quita los espacios de los lados', lineas[1].texto === 'C) El par motor');
  ok('los numeros son numeros', lineas.every((l) => Number.isInteger(l.arriba) && Number.isFinite(l.conf)));

  ok('aguanta una respuesta vacia', lineasDesdeJson({}).length === 0);
  ok('aguanta que no llegue nada', lineasDesdeJson(null).length === 0);
}

// --- Se enchufa con el resto del importador ---------------------------------
// Lo importante: unas líneas salidas del lector de macOS más una banda verde
// tienen que dar una pregunta entera, igual que con Tesseract.
console.log('\n--- Encaje con el analizador ---');
{
  const crudo = {
    ancho: 900, alto: 700,
    lineas: [
      { texto: '¿Que mide un par de apriete?', arriba: 100, abajo: 126, izquierda: 60, derecha: 520, conf: 98 },
      { texto: 'A) La velocidad de giro', arriba: 200, abajo: 226, izquierda: 60, derecha: 400, conf: 97 },
      { texto: 'B) La fuerza de giro aplicada', arriba: 250, abajo: 276, izquierda: 60, derecha: 430, conf: 96 },
      { texto: 'C) La temperatura', arriba: 300, abajo: 326, izquierda: 60, derecha: 380, conf: 97 },
    ],
  };
  const lineas = lineasDesdeJson(crudo);
  const bandas = [{ arriba: 246, abajo: 280 }];  // el verde tapa la opción B
  const extraida = extraerPregunta(lineas, bandas);

  ok('saca el enunciado', /par de apriete/.test(extraida.pregunta || ''));
  ok('saca las tres opciones', extraida.opciones.length === 3);
  ok('el verde manda: la correcta es la B', extraida.correcta === 1);
  ok('la da por completa', completa(extraida) === true);

  const sinVerde = extraerPregunta(lineas, []);
  ok('sin banda verde no se inventa la correcta', sinVerde.correcta === null);
  ok('y avisa de que esta incompleta', completa(sinVerde) === false);
  ok('tambien esta incompleta si falta el enunciado',
    completa({ pregunta: '', opciones: ['a', 'b'], correcta: 0 }) === false);
  ok('tambien si solo hay una opcion',
    completa({ pregunta: '¿Si?', opciones: ['a'], correcta: 0 }) === false);
}

// --- Agrupar líneas en opciones --------------------------------------------
// Aquí estuvo el fallo con Vision: sus cajas de texto son más altas que las de
// Tesseract, y el agrupador, que comparaba el hueco con la altura de la caja,
// metía las cuatro opciones en una sola. Ahora no mira la altura: mira si los
// huecos forman dos grupos distintos o son todos iguales.
console.log('\n--- Agrupar en opciones ---');
{
  // Cajas ALTAS (como las de Vision) y opciones de una línea cada una.
  const altas = [
    { texto: 'PREGUNTA: (Identificador nº 4242)', arriba: 100, abajo: 148, izquierda: 60, derecha: 700, conf: 99 },
    { texto: '¿Qué mide un par de apriete?', arriba: 170, abajo: 218, izquierda: 60, derecha: 700, conf: 99 },
    { texto: 'RESPUESTAS', arriba: 260, abajo: 308, izquierda: 60, derecha: 300, conf: 99 },
    { texto: 'La velocidad de giro del motor', arriba: 340, abajo: 388, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'La fuerza de giro aplicada al tornillo', arriba: 400, abajo: 448, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'La temperatura del aceite', arriba: 460, abajo: 508, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'El consumo de combustible', arriba: 520, abajo: 568, izquierda: 60, derecha: 700, conf: 97 },
  ];
  // El hueco entre opciones (12 px) es MENOR que la altura de la caja (48 px):
  // con el criterio antiguo se fusionaban todas.
  const r = extraerPregunta(altas, [{ arriba: 398, abajo: 450 }]);
  ok('no fusiona las opciones aunque las cajas sean altas', r.opciones.length === 4);
  ok('y sigue clavando la correcta por el verde', r.correcta === 1);

  // Una opción que ocupa dos líneas sí se une, porque ahí el hueco es distinto.
  const conPartida = [
    { texto: 'PREGUNTA: (Identificador nº 4243)', arriba: 100, abajo: 148, izquierda: 60, derecha: 700, conf: 99 },
    { texto: '¿Enunciado?', arriba: 170, abajo: 218, izquierda: 60, derecha: 700, conf: 99 },
    { texto: 'RESPUESTAS', arriba: 260, abajo: 308, izquierda: 60, derecha: 300, conf: 99 },
    { texto: 'Primera opción corta', arriba: 340, abajo: 388, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Segunda opción que es larga y ocupa', arriba: 400, abajo: 448, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'dos líneas seguidas sin separación', arriba: 449, abajo: 497, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Tercera opción corta', arriba: 549, abajo: 597, izquierda: 60, derecha: 700, conf: 97 },
  ];
  const r2 = extraerPregunta(conPartida, [{ arriba: 398, abajo: 500 }]);
  ok('une las dos lineas de una misma opcion', r2.opciones.length === 3);
  ok('el texto de la opcion larga sale entero',
     /larga y ocupa dos líneas/.test(r2.opciones[1] || ''));
  ok('la correcta sigue siendo la del verde', r2.correcta === 1);

  // Cinco opciones igualmente separadas: no debe inventarse una fusión para
  // que salgan cuatro. Tiene que avisar de que hay más de las habituales.
  const cinco = [
    { texto: 'PREGUNTA: (Identificador nº 4244)', arriba: 100, abajo: 124, izquierda: 60, derecha: 700, conf: 99 },
    { texto: '¿Enunciado?', arriba: 160, abajo: 184, izquierda: 60, derecha: 700, conf: 99 },
    { texto: 'RESPUESTAS', arriba: 220, abajo: 244, izquierda: 60, derecha: 300, conf: 99 },
    { texto: 'Opcion numero uno', arriba: 280, abajo: 304, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Opcion numero dos', arriba: 336, abajo: 360, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Opcion numero tres', arriba: 390, abajo: 414, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Opcion numero cuatro', arriba: 445, abajo: 469, izquierda: 60, derecha: 700, conf: 97 },
    { texto: 'Opcion numero cinco', arriba: 500, abajo: 524, izquierda: 60, derecha: 700, conf: 97 },
  ];
  const r3 = extraerPregunta(cinco, [{ arriba: 334, abajo: 362 }]);
  ok('no fuerza cuatro opciones si hay cinco', r3.opciones.length === 5);
  ok('y avisa de que son mas de las habituales',
     r3.avisos.some((a) => /más de las 4/.test(a)));
}

// --- Disponibilidad ---------------------------------------------------------
console.log('\n--- Disponibilidad ---');
{
  const estado = comprobarMacOS();
  ok('responde si se puede usar o no', typeof estado.ok === 'boolean');
  if (os.platform() === 'darwin') {
    if (estado.ok) console.log('  ..  este Mac puede usar el lector de macOS');
    else console.log('  ..  aviso: ' + estado.motivo.split('\n')[0]);
  } else {
    ok('fuera de un Mac lo dice claramente', estado.ok === false && /Mac/.test(estado.motivo));
  }
}

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
