// Escribe a disco las láminas dibujadas a mano, una por pregunta.
//
//   node herramientas/dibujar-laminas.mjs [carpeta]
//   node herramientas/dibujar-laminas.mjs --ver      (además, hoja de muestra)
//
// Por defecto las deja en ~/Downloads/laminas, que es la carpeta que luego se
// le da al panel en Banco → «Meter esas láminas».
//
// Cada archivo se llama como el identificador de su pregunta —cfsd-0007.svg—
// y eso es lo único que necesita el panel para colocarlas en su sitio.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lamina } from './importador/lamina.mjs';
import { LAMINAS as MECANICOS } from './laminas/cfsd-mecanicos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Todas las láminas dibujadas, de todos los submódulos. */
export const TODAS = { ...MECANICOS };

/** Construye el SVG de una lámina por el identificador de su pregunta. */
export function construirLamina(id) {
  const l = TODAS[id];
  if (!l) return null;
  return lamina({
    titulo: l.titulo,
    pie: l.pie,
    vista: l.vista,
    ejes: l.ejes,
    alto: l.alto,
    dibujo: l.dibujo(),
  });
}

export const IDS = Object.keys(TODAS);

// --- Ejecutado desde la línea de órdenes ------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const destino = path.resolve(
    (argv.find((a) => !a.startsWith('--')) || '~/Downloads/laminas')
      .replace(/^~/, os.homedir())
  );
  fs.mkdirSync(destino, { recursive: true });

  for (const id of IDS) {
    fs.writeFileSync(path.join(destino, `${id}.svg`), construirLamina(id));
  }
  console.log(`${IDS.length} lámina(s) escritas en ${destino}`);

  if (argv.includes('--ver')) {
    const hoja = path.join(RAIZ, 'laminas-de-muestra.html');
    fs.writeFileSync(hoja,
      '<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1">' +
      '<title>Láminas</title><body style="background:#0b1220;color:#e8ddc8;' +
      'font:15px/1.6 Georgia,serif;padding:18px;max-width:420px;margin:auto">' +
      `<h1 style="font-size:19px;margin:0 0 4px">${IDS.length} láminas</h1>` +
      '<p style="color:#93a3bd;margin:0 0 18px;font-style:italic;font-size:13px">' +
      'Una por pregunta. Esta página mide 420 px: lo que ocupan en el móvil.</p>' +
      IDS.map((id) =>
        `<div style="margin-bottom:6px;border-radius:5px;overflow:hidden">${construirLamina(id)}</div>` +
        `<p style="color:#5c6c85;font-size:11px;margin:0 0 24px;font-family:monospace">${id}</p>`
      ).join('') + '</body>');
    console.log('Muestra en ' + hoja);
  }
}
