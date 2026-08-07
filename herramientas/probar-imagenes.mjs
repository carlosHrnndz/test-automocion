// Pruebas del enlace entre las imágenes de public/images y sus preguntas.
//
//   node herramientas/probar-imagenes.mjs
//
// Se monta un proyecto de mentira en una carpeta temporal —con su copia de
// banco.mjs, su banco de preguntas y su carpeta de imágenes— porque banco.mjs
// escribe en el banco de verdad y no se puede probar sobre él.
//
// Lo que de verdad importa aquí es la tolerancia con los nombres: las imágenes
// se nombran a mano y un guion bajo en vez de un guion no puede hacer que una
// ilustración se pierda sin decir nada.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fallos = [];
const eq = (nombre, obtenido, esperado) => {
  const bien = JSON.stringify(obtenido) === JSON.stringify(esperado);
  console.log((bien ? '  OK   ' : '  FALLO') + ' ' + nombre +
              (bien ? '' : `  ->  ${JSON.stringify(obtenido)}  (esperaba ${JSON.stringify(esperado)})`));
  if (!bien) fallos.push(nombre);
};

// --- Proyecto de mentira ----------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'imagenes-'));
fs.mkdirSync(path.join(TMP, 'panel'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'src', 'lib'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'public', 'data', 'preguntas'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'public', 'images'), { recursive: true });

fs.copyFileSync(path.join(RAIZ, 'panel', 'banco.mjs'), path.join(TMP, 'panel', 'banco.mjs'));
fs.copyFileSync(path.join(RAIZ, 'src', 'lib', 'estructura.js'), path.join(TMP, 'src', 'lib', 'estructura.js'));

const pregunta = (n) => ({
  id: `cfsd-${n}`,
  moduloId: 'cfsd',
  modulo: 'CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN',
  submoduloId: 'sistemas-mecanicos',
  submodulo: 'SISTEMAS MECÁNICOS',
  pregunta: `Pregunta ${n}?`,
  opciones: ['A', 'B', 'C', 'D'],
  correcta: 0,
  explicacion: 'Una explicación.',
  ejemplo: 'Un ejemplo.',
  revisado: true,
});

fs.writeFileSync(
  path.join(TMP, 'public', 'data', 'preguntas', 'cfsd.json'),
  JSON.stringify(['0001', '0002', '0003', '0004', '0020'].map(pregunta), null, 2)
);
fs.writeFileSync(
  path.join(TMP, 'public', 'data', 'manifest.json'),
  JSON.stringify({ version: 1, modulos: [{ id: 'cfsd', archivo: 'preguntas/cfsd.json' }] }, null, 2)
);

const img = (nombre) => fs.writeFileSync(path.join(TMP, 'public', 'images', nombre), 'no es un png de verdad');
img('cfsd_0001.png');       // guion bajo, que es como salen de muchos sitios
img('cfsd-0002.jpg');       // nombre exacto
img('CFSD-0003.PNG');       // mayúsculas por todos lados
img('cfsd 0004.webp');      // con espacio
img('cfsd-9999.png');       // no hay ninguna pregunta así
img('apuntes.txt');         // no es una imagen
img('.DS_Store');           // basura del sistema

const banco = await import(path.join(TMP, 'panel', 'banco.mjs'));

// --- Del nombre del archivo al identificador --------------------------------
console.log('\n--- Nombres de archivo ---');
eq('el guion bajo vale igual que el guion', banco.idDeArchivo('cfsd_0007.png'), 'cfsd-0007');
eq('da igual mayúsculas o minúsculas', banco.idDeArchivo('CFSD-0020.PNG'), 'cfsd-0020');
eq('los espacios también valen', banco.idDeArchivo('cfsd 0007.webp'), 'cfsd-0007');
eq('y los puntos', banco.idDeArchivo('cfsd.0007.png'), 'cfsd-0007');

// --- Qué se considera una imagen -------------------------------------------
console.log('\n--- Qué archivos cuenta ---');
const lista = banco.listarImagenes();
eq('cuenta las cinco imágenes', lista.length, 5);
eq('no cuenta el .txt', lista.includes('apuntes.txt'), false);
eq('no cuenta los ocultos', lista.includes('.DS_Store'), false);

// --- El enlace --------------------------------------------------------------
console.log('\n--- Enlazar con las preguntas ---');
const r = banco.vincularImagenes();
eq('enlaza las cuatro que tienen pregunta', r.puestas.length, 4);
eq('avisa de la que no la tiene', r.sinPregunta, ['cfsd-9999.png']);
eq('no hay repetidas', r.repetidas.length, 0);

const leer = (id) => banco.leerModulo('cfsd').find((p) => p.id === id);
eq('la ruta es relativa a public', leer('cfsd-0001').imagen, 'images/cfsd_0001.png');
eq('respeta el nombre real, no el normalizado', leer('cfsd-0003').imagen, 'images/CFSD-0003.PNG');
eq('vale cualquier formato', leer('cfsd-0002').imagen, 'images/cfsd-0002.jpg');
eq('la pregunta sin imagen se queda igual', leer('cfsd-0020').imagen, undefined);

// --- Volver a darle no debe rehacer nada ------------------------------------
console.log('\n--- Darle dos veces ---');
const r2 = banco.vincularImagenes();
eq('no vuelve a enlazar lo ya enlazado', r2.puestas.length, 0);
eq('las cuenta como ya puestas', r2.yaEstaban.length, 4);

// --- Dos archivos para la misma pregunta ------------------------------------
console.log('\n--- Una pregunta con dos imágenes ---');
img('cfsd_0020.png');
img('cfsd-0020.jpg');
const r3 = banco.vincularImagenes();
eq('avisa del empate', r3.repetidas.map((x) => x.id), ['cfsd-0020']);
eq('y se queda con el primero por orden', leer('cfsd-0020').imagen, 'images/cfsd-0020.jpg');

// --- Quitar la ilustración --------------------------------------------------
console.log('\n--- Quitarla ---');
eq('dice que la ha quitado', banco.desvincularImagen('cfsd-0001'), true);
eq('la pregunta se queda sin imagen', leer('cfsd-0001').imagen, undefined);
eq('pero el archivo sigue ahí',
   fs.existsSync(path.join(TMP, 'public', 'images', 'cfsd_0001.png')), true);
eq('quitar la de una pregunta que no existe no revienta', banco.desvincularImagen('no-existe'), false);

// --- Sin carpeta de imágenes ------------------------------------------------
console.log('\n--- Sin carpeta public/images ---');
fs.rmSync(path.join(TMP, 'public', 'images'), { recursive: true, force: true });
eq('no revienta si no existe', banco.listarImagenes(), []);
eq('y el enlace no hace nada', banco.vincularImagenes().total, 0);

fs.rmSync(TMP, { recursive: true, force: true });

console.log('');
if (fallos.length) {
  console.log(`>>> ${fallos.length} FALLOS: ${fallos.join(', ')}`);
  process.exit(1);
}
console.log('>>> Todo correcto');
