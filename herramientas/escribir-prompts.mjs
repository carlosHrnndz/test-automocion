// Escribe un archivo con un prompt de ilustración por cada pregunta del banco.
//
//   node herramientas/escribir-prompts.mjs                    (todo el banco)
//   node herramientas/escribir-prompts.mjs --modulo cfsd
//   node herramientas/escribir-prompts.mjs --tema "RUEDAS"
//   node herramientas/escribir-prompts.mjs --destino ~/Downloads
//
// Salen dos archivos:
//   prompts-ilustraciones.md     para leer y copiar y pegar a mano
//   prompts-ilustraciones.jsonl  una línea por pregunta, para automatizar
//
// La instrucción de estilo va entera al principio del .md y repetida en cada
// línea del .jsonl, para que cada prompt se valga por sí solo.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as banco from '../panel/banco.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- La instrucción de estilo -----------------------------------------------
//
// Es lo mismo que se aplicó a mano en las láminas del cuaderno, escrito para
// que lo entienda otra IA. Las medidas no son adorno: salen de medir cómo se
// ve una lámina en un iPhone.

export const ESTILO = `Eres ilustrador técnico. Dibujas láminas didácticas de mecánica del automóvil
para un alumno de Grado Superior que estudia en el móvil.

Devuelve ÚNICAMENTE el código SVG, empezando por <svg y terminando en </svg>.
Sin markdown, sin explicaciones, sin \`\`\`.

FORMATO
- viewBox="0 0 420 H", con H entre 260 y 480 según lo que necesites.
- 420 px de ancho no es negociable: en un móvil la lámina se ve a unos 340 px.
  Todo se encoge un 20 %, así que la letra más pequeña que puedes usar es 12 px
  (se verá a 10). Cualquier cosa por debajo es ilegible.
- Cuando compares dos casos, ponlos UNO DEBAJO DE OTRO, no lado a lado: en 420
  px de ancho dos columnas dejan cada dibujo demasiado pequeño.

ESTILO: lámina de cuaderno antiguo, sepia sobre pergamino
- Fondo: un <rect> de 420×H relleno de #f2e8d5, y un marco interior fino
  (#6d5638, opacidad 0.5) a 7 px del borde.
- Trazo principal #4a3728. Trazos secundarios, sombreados y notas al margen
  #6d5638. Rojo sanguina #a44a28 SÓLO para lo que importa: fuerzas,
  movimiento, el punto clave. Si todo es rojo, nada es rojo.
- Tipografía serif: font-family="Iowan Old Style, Palatino, Georgia, serif".
  Título 17.5 px peso 600, centrado arriba. Rótulos 13-14.5 px. Notas al margen
  en cursiva, 12.5 px.
- Trazo de mano alzada: define este filtro y aplícalo SÓLO a los trazos, nunca
  al texto (deformar una letra la hace ilegible):
  <filter id="pulso"><feTurbulence type="fractalNoise" baseFrequency="0.028"
  numOctaves="3" seed="9" result="r"/><feDisplacementMap in="SourceGraphic"
  in2="r" scale="2.1" xChannelSelector="R" yChannelSelector="G"/></filter>
- VOLUMEN: la luz viene siempre de arriba a la izquierda. Un contorno sin
  sombra se lee como un plano; con sombra, como una pieza. Usa degradados
  suaves sobre las piezas y una elipse difuminada como sombra proyectada.
- Texturas a plumilla (rayado con <pattern>) para materiales: el flanco de un
  neumático, el aceite de un circuito, una sección cortada.

EJES
- Abajo a la izquierda, una rosa pequeña con los ejes que definan la
  orientación de lo que se ve, y sólo ésos.
- Orientados como los ve la cámara: si el eje va a la derecha en el dibujo, su
  flecha va a la derecha. El eje que sale del papel hacia ti se marca con un
  círculo con un punto dentro; el que se aleja, con un círculo con un aspa.
- Sólo las letras X, Y, Z, sin signos.
- Al lado, en cursiva: "visto de frente" / "visto desde arriba" / "visto de
  lado" / "sección". Si es un detalle suelto, no pongas ejes.

QUÉ DIBUJAR
- La ilustración tiene que explicar ESTA pregunta, no el tema en general. Lee
  la explicación y el ejemplo y dibuja lo que hace entender ESO.
- Si dos preguntas tratan del mismo asunto pero preguntan cosas distintas, sus
  láminas tienen que ser distintas.
- Dibuja la PIEZA, no una caja con su nombre dentro. Un diagrama de recuadros
  con texto no enseña nada que no dijera ya la explicación.
- Rotula lo justo: cinco o seis etiquetas cortas como mucho. Un pie de una o
  dos líneas abajo, en cursiva, con la idea que hay que llevarse.
- No inventes cifras ni medidas que no estén en la explicación.

LO QUE NO PUEDE PASAR
- Que dos rótulos se pisen. Cuenta el espacio: un carácter ocupa
  aproximadamente la mitad del tamaño de letra.
- Que algo se salga del viewBox.
- Que el texto pase por el filtro de mano alzada.
- Que la letra baje de 12 px.`;

/** El prompt de una pregunta concreta. */
export function promptDe(p) {
  const partes = [
    `Pregunta de test: ${p.pregunta}`,
    `Respuesta correcta: ${p.opciones?.[p.correcta] ?? ''}`,
  ];
  if (p.explicacion) partes.push(`\nExplicación:\n${p.explicacion}`);
  if (p.ejemplo) partes.push(`\nEjemplo de taller:\n${p.ejemplo}`);
  if (p.submodulo) partes.push(`\nTema: ${p.submodulo}`);
  partes.push('\nDibuja la lámina que ayude a entender esta pregunta.');
  return partes.join('\n');
}

// --- Ejecutado desde la línea de órdenes ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opcion = (nombre) => {
    const i = argv.indexOf('--' + nombre);
    return i >= 0 ? argv[i + 1] : null;
  };
  const modulo = opcion('modulo');
  const tema = opcion('tema');
  const destino = path.resolve((opcion('destino') || RAIZ).replace(/^~/, os.homedir()));

  let preguntas = modulo ? banco.leerModulo(modulo) : banco.leerTodo();
  if (tema) {
    const normal = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    preguntas = preguntas.filter((p) => normal(p.submodulo).includes(normal(tema)));
  }
  if (!preguntas.length) {
    console.error('No hay preguntas que encajen con eso.');
    process.exit(1);
  }

  // --- Archivo para leer ---
  const md = [
    '# Prompts de ilustración',
    '',
    `${preguntas.length} preguntas. Un prompt por cada una.`,
    '',
    'Pega primero el bloque de **Instrucción de estilo** —una sola vez, como',
    'mensaje de sistema— y después el prompt de la pregunta que quieras. Cada',
    'prompt lleva su identificador: guarda el SVG que te devuelvan con ese',
    'nombre (`cfsd-0007.svg`) y mételos todos con el panel, en Banco → «Meter',
    'esas láminas».',
    '',
    '---',
    '',
    '## Instrucción de estilo',
    '',
    '```',
    ESTILO,
    '```',
    '',
    '---',
    '',
  ];

  const jsonl = [];
  for (const p of preguntas) {
    const prompt = promptDe(p);
    md.push(`## ${p.id}`, '');
    md.push(`*${p.submodulo || 'sin tema'}* · guarda el resultado como \`${p.id}.svg\``, '');
    md.push('```', prompt, '```', '');
    jsonl.push(JSON.stringify({ id: p.id, tema: p.submodulo || null, sistema: ESTILO, prompt }));
  }

  fs.mkdirSync(destino, { recursive: true });
  const rutaMd = path.join(destino, 'prompts-ilustraciones.md');
  const rutaJsonl = path.join(destino, 'prompts-ilustraciones.jsonl');
  fs.writeFileSync(rutaMd, md.join('\n'));
  fs.writeFileSync(rutaJsonl, jsonl.join('\n') + '\n');

  console.log(`${preguntas.length} prompts escritos:`);
  console.log('  ' + rutaMd);
  console.log('  ' + rutaJsonl);
}
