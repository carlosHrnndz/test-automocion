// ---------------------------------------------------------------------------
// Diagnóstico: enseña exactamente qué está leyendo el lector en una captura.
//
//   node herramientas/ver-lectura.mjs "/ruta/a/la/captura.png"
//   node herramientas/ver-lectura.mjs "/ruta/a/la/captura.png" --motor ocr
//
// No toca el banco ni guarda nada. Sólo imprime, para poder ver dónde se
// tuerce la lectura sin tener que adivinar.
// ---------------------------------------------------------------------------

import path from 'node:path';
import { leerImagen, bandasVerdes, ampliarParaOcr } from './importador/imagen.mjs';
import { ocrLineas } from './importador/ocr.mjs';
import { ocrLineasMacOS, comprobarMacOS } from './importador/ocr-macos.mjs';
import { extraerPregunta } from './importador/parseo.mjs';

const argv = process.argv.slice(2);
const ruta = argv.find((a) => !a.startsWith('--'));
const iMotor = argv.indexOf('--motor');
const motor = iMotor >= 0 ? argv[iMotor + 1] : 'macos';

if (!ruta) {
  console.error('\nFalta la captura.\n\n  node herramientas/ver-lectura.mjs "/ruta/a/la/captura.png"\n');
  process.exit(1);
}

const img = leerImagen(ruta);
const bandas = bandasVerdes(img);

console.log('\n=== ' + path.basename(ruta) + ' ===');
console.log(`imagen: ${img.width} x ${img.height} px · motor: ${motor}`);
console.log(`bandas verdes: ${bandas.length}`);
for (const b of bandas) {
  console.log(`  verde  y ${b.arriba}-${b.abajo}  (alto ${b.abajo - b.arriba})`);
}

let lineas;
if (motor === 'macos') {
  const estado = comprobarMacOS();
  if (!estado.ok) { console.error('\n' + estado.motivo + '\n'); process.exit(1); }
  lineas = ocrLineasMacOS(ruta);
} else {
  lineas = ocrLineas(ampliarParaOcr(img, 2),
    { idioma: 'spa', escala: 2, tessdata: process.env.TESSDATA_DIR || null });
}

console.log(`\nlíneas leídas: ${lineas.length}`);
console.log('   y1    y2  alto hueco  izq  der conf  texto');
let previa = null;
for (const l of lineas) {
  const hueco = previa ? l.arriba - previa.abajo : 0;
  console.log(
    String(l.arriba).padStart(5) +
    String(l.abajo).padStart(6) +
    String(l.abajo - l.arriba).padStart(6) +
    String(hueco).padStart(6) +
    String(l.izquierda).padStart(5) +
    String(l.derecha).padStart(5) +
    String(l.conf).padStart(5) +
    '  ' + l.texto.slice(0, 70)
  );
  previa = l;
}

const r = extraerPregunta(lineas, bandas);
console.log('\n--- lo que ha entendido ---');
console.log('identificador: ' + (r.idExterno || '—'));
console.log('enunciado: ' + (r.pregunta || '—'));
console.log(`opciones (${r.opciones.length}):`);
r.opciones.forEach((o, i) => {
  console.log(`  ${'ABCD'[i] || i}${r.correcta === i ? ' ← verde' : '       '}  ${o}`);
});
console.log('correcta: ' + (r.correcta === null ? 'no determinada' : 'ABCD'[r.correcta]));
if (r.avisos?.length) {
  console.log('\navisos:');
  for (const a of r.avisos) console.log('  · ' + a);
}
console.log('');
