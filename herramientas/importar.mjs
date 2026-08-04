#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Importador de carpetas de capturas.
//
//   npm run importar -- ~/Automocion
//
// Espera una estructura de dos niveles:
//
//   Automocion/
//     CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN/
//       RUEDAS/
//         001.png  002.png  ...
//         temario.pdf
//       SISTEMAS MECÁNICOS/
//         ...
//
// De cada imagen saca la pregunta, las opciones y cuál está en verde.
// Del PDF saca el temario para fundamentar las explicaciones.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESTRUCTURA, slug } from '../src/lib/estructura.js';
import { leerImagen, bandasVerdes, ampliarParaOcr, EXTENSIONES } from './importador/imagen.mjs';
import { hayTesseract, idiomasDisponibles, ocrLineas } from './importador/ocr.mjs';
import { comprobarMacOS, ocrLineasMacOS } from './importador/ocr-macos.mjs';
import { extraerPregunta, rescatarZonasVerdes, completa } from './importador/parseo.mjs';
import { textoPdf, trocear, buscarRelevantes } from './importador/pdf.mjs';
import { generar, extraerCampos, comprobarOllama } from './importador/ollama.mjs';
import { extraerConVision, combinar } from './importador/vision.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'public', 'data');
// Cuánto se amplía la captura antes de leerla. Medido: x2 con suavizado da el
// mejor resultado; x3 no mejora y tarda el doble.
const ESCALA_OCR = 2;

// --- Colores de consola -----------------------------------------------------
const C = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  ambar: (t) => `\x1b[33m${t}\x1b[0m`,
  azul: (t) => `\x1b[36m${t}\x1b[0m`,
  fuerte: (t) => `\x1b[1m${t}\x1b[0m`,
};

// --- Argumentos -------------------------------------------------------------
function leerArgumentos(argv) {
  const o = {
    carpeta: null,
    modelo: 'qwen3:4b',
    url: 'http://localhost:11434',
    idioma: 'spa',
    sinIa: false,
    forzar: false,
    limpiar: false,
    limite: Infinity,
    tessdata: null,
    modulo: null,
    motor: 'macos',            // macos | macos-ia | ocr | vision | ambos
    modeloVision: 'gemma3:4b',
  };
  const libres = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sin-ia') o.sinIa = true;
    else if (a === '--forzar') o.forzar = true;
    else if (a === '--limpiar') o.limpiar = true;
    else if (a === '--modelo') o.modelo = argv[++i];
    else if (a === '--url') o.url = argv[++i];
    else if (a === '--idioma') o.idioma = argv[++i];
    else if (a === '--tessdata') o.tessdata = argv[++i];
    else if (a === '--modulo') o.modulo = argv[++i];
    else if (a === '--motor') o.motor = argv[++i];
    else if (a === '--modelo-vision') o.modeloVision = argv[++i];
    else if (a === '--limite') o.limite = Number(argv[++i]) || Infinity;
    else if (a === '--ayuda' || a === '-h') o.ayuda = true;
    else libres.push(a);
  }
  o.carpeta = libres[0] || null;
  return o;
}

const AYUDA = `
${C.fuerte('Importador de capturas')}

  npm run importar -- <carpeta> [opciones]

Ejecútalo desde la carpeta del proyecto (donde está package.json).

La <carpeta> puede ser cualquiera de estos tres niveles; se detecta solo:
  · la que contiene varias carpetas de módulo
  · la de un módulo, con sus temas dentro
  · la de un tema suelta, con las imágenes dentro (necesita --modulo)

Opciones:
  --sin-ia            Sólo extrae las preguntas, no genera explicaciones
  --motor <nombre>    Cómo se lee la imagen (por defecto macos):
                        macos      lector de macOS, el de Vista Previa · rápido
                        macos-ia   igual, con el modelo de visión de refuerzo
                        ocr        tesseract
                        vision     modelo de visión
                        ambos      visión para el texto + verde para la respuesta
  --modulo <id>       Fuerza el módulo (${ESTRUCTURA.map((m) => m.id).join(', ')})
  --modelo <nombre>   Modelo de Ollama (por defecto qwen3:4b)
  --url <url>         Servidor de Ollama (por defecto http://localhost:11434)
  --idioma <cod>      Idioma del OCR (por defecto spa)
  --limite <n>        Procesa como mucho n imágenes por tema (para probar)
  --forzar            Rehace las preguntas que ya estaban, en su sitio y sin duplicar
  --limpiar           Vacía los módulos afectados antes de importar (empezar de cero)
  --ayuda             Esto

Para la primera prueba, rápido y sin gastar tiempo en explicaciones:
  npm run importar -- ~/Automocion --limite 2 --sin-ia
`;

// --- Utilidades -------------------------------------------------------------

function normaliza(t) {
  return String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Empareja el nombre de una carpeta con un módulo del temario. */
function buscarModulo(nombreCarpeta) {
  const n = normaliza(nombreCarpeta);
  // Coincidencia por id: carpeta llamada "cfsd" o "cfsd - lo que sea"
  const porId = ESTRUCTURA.find((m) => n === m.id || n.startsWith(m.id + ' '));
  if (porId) return porId;
  // Coincidencia exacta o por contención del nombre completo
  const exacto = ESTRUCTURA.find((m) => normaliza(m.nombre) === n);
  if (exacto) return exacto;
  const contiene = ESTRUCTURA.find((m) => n.includes(normaliza(m.nombre)) || normaliza(m.nombre).includes(n));
  if (contiene) return contiene;
  // Última opción: la que más palabras comparte
  let mejor = null, mejorPuntos = 0;
  const palabras = new Set(n.split(' ').filter((p) => p.length > 3));
  for (const m of ESTRUCTURA) {
    const suyas = new Set(normaliza(m.nombre).split(' ').filter((p) => p.length > 3));
    const comunes = [...palabras].filter((p) => suyas.has(p)).length;
    if (comunes > mejorPuntos) { mejorPuntos = comunes; mejor = m; }
  }
  return mejorPuntos >= 2 ? mejor : null;
}

function listarDirectorios(base) {
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function listarArchivos(base, extensiones) {
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') &&
                   extensiones.includes(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

const tieneImagenes = (dir) => listarArchivos(dir, EXTENSIONES).length > 0;

/**
 * Averigua qué le has pasado, para que no tengas que acordarte del nivel exacto:
 *
 *   'raiz'   → carpeta con módulos dentro    (…/preguntas)
 *   'modulo' → carpeta de un módulo          (…/preguntas/CIRCUITOS DE FLUIDOS…)
 *   'tema'   → carpeta de un tema con las imágenes dentro (…/RUEDAS)
 */
function detectarNivel(base) {
  if (tieneImagenes(base)) return 'tema';
  const subs = listarDirectorios(base);
  if (!subs.length) return 'vacio';
  return subs.some((s) => tieneImagenes(path.join(base, s))) ? 'modulo' : 'raiz';
}

function cargarExistentes(moduloId) {
  const ruta = path.join(DATOS, 'preguntas', `${moduloId}.json`);
  if (!fs.existsSync(ruta)) return [];
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return []; }
}

function guardarModulo(moduloId, preguntas) {
  const dir = path.join(DATOS, 'preguntas');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${moduloId}.json`), JSON.stringify(preguntas, null, 2) + '\n');
}

function actualizarManifiesto() {
  const dir = path.join(DATOS, 'preguntas');
  const presentes = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
    : [];
  const manifiesto = {
    titulacion: 'Técnico Superior en Automoción',
    version: 1,
    actualizado: new Date().toISOString().slice(0, 10),
    modulos: ESTRUCTURA.filter((m) => presentes.includes(m.id))
      .map((m) => ({ id: m.id, archivo: `preguntas/${m.id}.json` })),
  };
  fs.writeFileSync(path.join(DATOS, 'manifest.json'), JSON.stringify(manifiesto, null, 2) + '\n');
  return manifiesto.modulos.length;
}

function siguienteNumero(preguntas, moduloId) {
  const usados = preguntas
    .filter((p) => p.moduloId === moduloId)
    .map((p) => Number(String(p.id).split('-').pop()))
    .filter((n) => Number.isFinite(n));
  return usados.length ? Math.max(...usados) + 1 : 1;
}

const clave = (p) => (p.idExterno ? 'ext:' + p.idExterno : slug(p.pregunta).slice(0, 80));

// --- Programa principal -----------------------------------------------------

async function principal() {
  const op = leerArgumentos(process.argv.slice(2));
  if (op.ayuda || !op.carpeta) { console.log(AYUDA); process.exit(op.carpeta ? 0 : 1); }

  const base = path.resolve(op.carpeta.replace(/^~/, process.env.HOME || '~'));
  if (!fs.existsSync(base)) { console.error(C.rojo(`No existe la carpeta: ${base}`)); process.exit(1); }

  // --- Comprobaciones previas ---
  const MOTORES = ['macos', 'macos-ia', 'ocr', 'vision', 'ambos'];
  if (!MOTORES.includes(op.motor)) {
    console.error(C.rojo(`\nMotor desconocido "${op.motor}". Válidos: ${MOTORES.join(', ')}\n`));
    process.exit(1);
  }

  if (op.motor === 'macos' || op.motor === 'macos-ia') {
    const estado = comprobarMacOS();
    if (!estado.ok) {
      console.error(C.rojo('\nNo se puede usar el lector de macOS.\n'));
      console.error(estado.motivo + '\n');
      console.error(C.gris('Mientras tanto puedes usar:  --motor ocr\n'));
      process.exit(1);
    }
  }

  const necesitaOcr = op.motor === 'ocr' || op.motor === 'ambos';
  if (necesitaOcr) {
    if (!hayTesseract()) {
      console.error(C.rojo('\nFalta Tesseract, que es quien lee el texto de las imágenes.\n'));
      console.error('  brew install tesseract tesseract-lang\n');
      console.error(C.gris('  O usa el modelo de visión:  --motor vision\n'));
      process.exit(1);
    }
    const idiomas = idiomasDisponibles(op.tessdata);
    if (idiomas.length && !idiomas.includes(op.idioma)) {
      console.error(C.rojo(`\nTesseract no tiene el idioma "${op.idioma}". Instalado: ${idiomas.join(', ')}\n`));
      console.error('  brew install tesseract-lang\n');
      process.exit(1);
    }
  }

  if (op.motor === 'vision' || op.motor === 'ambos' || op.motor === 'macos-ia') {
    let modelos = [];
    try {
      modelos = await comprobarOllama(op.url);
    } catch {
      console.error(C.rojo('\nOllama no responde y el motor de visión lo necesita.'));
      console.error('Abre Ollama desde Aplicaciones y vuelve a intentarlo.\n');
      process.exit(1);
    }
    if (!modelos.includes(op.modeloVision)) {
      console.error(C.rojo(`\nOllama no tiene el modelo "${op.modeloVision}".`));
      console.error(`Disponibles: ${modelos.join(', ') || 'ninguno'}\n`);
      console.error(`  ollama pull ${op.modeloVision}\n`);
      console.error(C.gris('Recuerda que el modelo tiene que ver imágenes. gemma3:4b sí,'));
      console.error(C.gris('y cabe en 8 GB de memoria.\n'));
      process.exit(1);
    }
  }

  let usarIa = !op.sinIa;
  if (usarIa) {
    try {
      const modelos = await comprobarOllama(op.url);
      if (!modelos.includes(op.modelo)) {
        console.log(C.ambar(`\nOllama no tiene "${op.modelo}". Disponibles: ${modelos.join(', ') || 'ninguno'}`));
        console.log(C.ambar(`Se importarán las preguntas sin explicación. Para tenerla:  ollama pull ${op.modelo}\n`));
        usarIa = false;
      }
    } catch {
      console.log(C.ambar('\nNo se ha podido hablar con Ollama; se importará sin explicaciones.'));
      console.log(C.ambar('Abre Ollama y vuelve a ejecutarlo, o usa --sin-ia para no ver este aviso.\n'));
      usarIa = false;
    }
  }

  const comoLee = {
    macos: 'lector de macOS (Vision)',
    'macos-ia': `lector de macOS, con ${op.modeloVision} de refuerzo si hace falta`,
    ocr: `tesseract (${op.idioma})`,
    vision: `modelo de visión (${op.modeloVision})`,
    ambos: `${op.modeloVision} para el texto + verde para la respuesta`,
  }[op.motor];

  console.log(C.fuerte(`\nImportando desde ${base}`));
  console.log(C.gris(`Lectura: ${comoLee} · Explicaciones: ${usarIa ? op.modelo : 'desactivadas'}`));

  // --- ¿Qué nivel me han pasado? ---
  const nivel = detectarNivel(base);
  if (nivel === 'vacio') {
    console.error(C.rojo('\nLa carpeta está vacía: no hay ni imágenes ni subcarpetas.'));
    process.exit(1);
  }

  const resumen = [];
  const porModulo = new Map();   // moduloId -> array de preguntas (existentes + nuevas)
  const vistos = new Map();      // moduloId -> Set de claves

  const prepararModulo = (modulo) => {
    if (porModulo.has(modulo.id)) return;
    if (op.limpiar) {
      const habia = cargarExistentes(modulo.id).length;
      porModulo.set(modulo.id, []);
      vistos.set(modulo.id, new Set());
      console.log(C.ambar(`  --limpiar: se descartan las ${habia} preguntas que había en este módulo`));
      return;
    }
    const existentes = cargarExistentes(modulo.id);
    porModulo.set(modulo.id, existentes);
    vistos.set(modulo.id, new Set(existentes.map(clave)));
    if (existentes.length) {
      console.log(C.gris(`  ${existentes.length} preguntas ya en el banco (las repetidas se saltarán)`));
    }
  };

  const moduloForzado = op.modulo ? ESTRUCTURA.find((m) => m.id === op.modulo) : null;
  if (op.modulo && !moduloForzado) {
    console.error(C.rojo(`\nNo existe el módulo "${op.modulo}". Válidos: ${ESTRUCTURA.map((m) => m.id).join(', ')}`));
    process.exit(1);
  }

  // --- Caso: me han dado una carpeta de tema suelta ---
  if (nivel === 'tema') {
    const nombreTema = path.basename(base);
    const modulo = moduloForzado || buscarModulo(path.basename(path.dirname(base)));
    if (!modulo) {
      console.error(C.rojo(`\n"${nombreTema}" parece la carpeta de un tema (tiene imágenes dentro),`));
      console.error(C.rojo('pero no se sabe a qué módulo pertenece.\n'));
      console.error('Tienes dos opciones:');
      console.error(`  · Pasar la carpeta de arriba:  npm run importar -- "${path.dirname(base)}"`);
      console.error(`  · Decir el módulo a mano:      npm run importar -- "${base}" --modulo cfsd\n`);
      console.error(C.gris('Módulos: ' + ESTRUCTURA.map((m) => `${m.id} (${m.corto})`).join(', ')));
      process.exit(1);
    }
    console.log(C.gris(`Detectado: una carpeta de tema dentro de ${modulo.corto}\n`));
    console.log(C.azul(C.fuerte(modulo.nombre)));
    prepararModulo(modulo);
    await procesarTema({
      rutaTema: base, nombreTema, modulo, op, usarIa,
      preguntas: porModulo.get(modulo.id), vistos: vistos.get(modulo.id), resumen,
    });
    return await cerrar({ porModulo, resumen, base, op });
  }

  // --- Caso: me han dado la carpeta de un módulo ---
  if (nivel === 'modulo') {
    const nombreModulo = path.basename(base);
    const modulo = moduloForzado || buscarModulo(nombreModulo);
    if (!modulo) {
      console.error(C.rojo(`\n"${nombreModulo}" tiene carpetas de tema dentro, pero su nombre no coincide`));
      console.error(C.rojo('con ningún módulo del temario.\n'));
      console.error(`  npm run importar -- "${base}" --modulo cfsd\n`);
      console.error(C.gris('Módulos: ' + ESTRUCTURA.map((m) => `${m.id} (${m.corto})`).join(', ')));
      process.exit(1);
    }
    console.log(C.gris(`Detectado: la carpeta de un módulo\n`));
    console.log(C.azul(C.fuerte(modulo.nombre)) + C.gris(`  (${nombreModulo})`));
    prepararModulo(modulo);
    for (const nombreTema of listarDirectorios(base)) {
      await procesarTema({
        rutaTema: path.join(base, nombreTema), nombreTema, modulo, op, usarIa,
        preguntas: porModulo.get(modulo.id), vistos: vistos.get(modulo.id), resumen,
      });
    }
    return await cerrar({ porModulo, resumen, base, op });
  }

  // --- Caso normal: carpeta raíz con módulos dentro ---
  console.log(C.gris('Detectado: carpeta con varios módulos\n'));
  const carpetasModulo = listarDirectorios(base);

  for (const nombreModulo of carpetasModulo) {
    const modulo = buscarModulo(nombreModulo);
    if (!modulo) {
      console.log(C.rojo(`✗ ${nombreModulo}`));
      console.log(C.gris('  No coincide con ningún módulo del temario. Renombra la carpeta o añade el módulo'));
      console.log(C.gris('  a src/lib/estructura.js. Módulos válidos: ' + ESTRUCTURA.map((m) => m.id).join(', ')));
      resumen.push({ carpeta: nombreModulo, estado: 'módulo desconocido' });
      continue;
    }

    console.log(C.azul(C.fuerte(`\n${modulo.nombre}`)) + C.gris(`  (${nombreModulo})`));
    prepararModulo(modulo);

    const carpetasTema = listarDirectorios(path.join(base, nombreModulo));
    if (!carpetasTema.length) {
      console.log(C.ambar('  Sin subcarpetas de tema; se omite.'));
      continue;
    }

    for (const nombreTema of carpetasTema) {
      await procesarTema({
        rutaTema: path.join(base, nombreModulo, nombreTema),
        nombreTema, modulo, op, usarIa,
        preguntas: porModulo.get(modulo.id),
        vistos: vistos.get(modulo.id),
        resumen,
      });
    }
  }

  return await cerrar({ porModulo, resumen, base, op });
}

// --- Guardado e informe final ----------------------------------------------

/**
 * Reconstruye el comando que acabas de lanzar, con la ruta real y las opciones
 * que usaste, para poder sugerirte variantes copiables tal cual.
 */
function comando(base, op, extra = []) {
  const partes = ['npm run importar --', `"${base}"`];
  if (op.limite !== Infinity) partes.push('--limite', String(op.limite));
  if (op.sinIa) partes.push('--sin-ia');
  if (op.modulo) partes.push('--modulo', op.modulo);
  if (op.modelo !== 'qwen3:4b') partes.push('--modelo', op.modelo);
  return [...partes, ...extra].join(' ');
}

async function cerrar({ porModulo, resumen, base, op }) {
  console.log('');
  let total = 0;
  for (const [moduloId, preguntas] of porModulo) {
    if (!preguntas.length) continue;
    guardarModulo(moduloId, preguntas);
    total += preguntas.length;
    console.log(C.gris(`  public/data/preguntas/${moduloId}.json · ${preguntas.length} preguntas`));
  }
  if (total) {
    const n = actualizarManifiesto();
    console.log(C.gris(`  public/data/manifest.json · ${n} módulo(s)`));
  }

  console.log(C.fuerte('\nResumen\n'));
  const anchoTema = Math.max(20, ...resumen.map((r) => (r.tema || r.carpeta || '').length));
  for (const r of resumen) {
    const etiqueta = (r.tema || r.carpeta || '').padEnd(anchoTema);
    if (r.estado) { console.log(`  ${C.rojo('✗')} ${etiqueta}  ${C.rojo(r.estado)}`); continue; }
    const partes = [`${r.nuevas} nuevas`];
    if (r.actualizadas) partes.push(C.azul(`${r.actualizadas} rehechas`));
    if (r.duplicadas) partes.push(C.gris(`${r.duplicadas} repetidas`));
    if (r.conExplicacion) partes.push(C.verde(`${r.conExplicacion} con explicación`));
    if (r.problemas) partes.push(C.ambar(`${r.problemas} a revisar`));
    console.log(`  ${r.problemas ? C.ambar('!') : C.verde('✓')} ${etiqueta}  ${partes.join(' · ')}`);
  }

  const aRevisar = resumen.reduce((n, r) => n + (r.problemas || 0), 0);
  const nuevas = resumen.reduce((n, r) => n + (r.nuevas || 0), 0);
  const rehechas = resumen.reduce((n, r) => n + (r.actualizadas || 0), 0);
  const repetidas = resumen.reduce((n, r) => n + (r.duplicadas || 0), 0);
  console.log('');

  if (!nuevas && !rehechas && repetidas) {
    // El caso confuso: todo estaba ya. Explicamos por qué y damos los comandos hechos.
    console.log(C.ambar(`Ninguna pregunta nueva: las ${repetidas} ya estaban en public/data/preguntas/.`));
    console.log(C.gris('Se comparan por el identificador de la academia, así que da igual el nombre'));
    console.log(C.gris('del archivo de imagen: la misma pregunta no entra dos veces.\n'));
    console.log('Para empezar de cero (vacía el módulo y vuelve a importar):');
    console.log(C.verde('  ' + comando(base, op, ['--limpiar'])) + '\n');
    console.log('Para rehacerlas sin perder nada (las actualiza en su sitio):');
    console.log(C.verde('  ' + comando(base, op, ['--forzar'])));
  } else if (!nuevas && !rehechas) {
    console.log(C.ambar('No se ha importado ninguna pregunta.'));
  } else {
    const trozos = [];
    if (nuevas) trozos.push(`${nuevas} nuevas`);
    if (rehechas) trozos.push(`${rehechas} rehechas`);
    console.log(C.verde(`${trozos.join(' y ')} en el banco.`));
    if (aRevisar) {
      console.log(C.ambar(`${aRevisar} necesitan que las mires: abre herramientas/capturador.html,`));
      console.log(C.ambar('pestaña Banco, y busca las marcadas como sin revisar.'));
    }

    // Si fue una prueba corta, damos hecho el comando de la pasada completa.
    const opCompleto = { ...op, limite: Infinity, sinIa: false };
    if (op.limite !== Infinity || op.sinIa) {
      console.log('\nEsto era una prueba. Para la pasada completa:');
      console.log(C.verde('  ' + comando(base, opCompleto)));
    }

    console.log(C.gris('\nCuando estén revisadas:  git add public/data && git commit -m "Nuevas preguntas" && git push'));
  }
}

// --- Un tema ---------------------------------------------------------------

async function procesarTema({ rutaTema, nombreTema, modulo, op, usarIa, preguntas, vistos, resumen }) {
  const imagenes = listarArchivos(rutaTema, EXTENSIONES).slice(0, op.limite);
  const pdfs = listarArchivos(rutaTema, ['.pdf']);

  process.stdout.write(`  ${nombreTema} ${C.gris(`· ${imagenes.length} imágenes${pdfs.length ? ' · ' + pdfs.length + ' PDF' : ''}`)}\n`);

  if (!imagenes.length) {
    resumen.push({ tema: nombreTema, estado: 'sin imágenes' });
    return;
  }

  // --- Temario del tema ---
  let trozos = [];
  if (usarIa && pdfs.length) {
    for (const pdf of pdfs) {
      try {
        const paginas = await textoPdf(path.join(rutaTema, pdf));
        const caracteres = paginas.reduce((n, p) => n + p.texto.length, 0);
        if (caracteres < 500) {
          console.log(C.ambar(`    ${pdf}: casi no tiene texto. ¿Es un PDF escaneado? Se seguirá sin él.`));
        } else {
          trozos = trozos.concat(trocear(paginas));
          console.log(C.gris(`    ${pdf}: ${paginas.length} páginas, ${trozos.length} fragmentos`));
        }
      } catch (e) {
        console.log(C.ambar(`    ${pdf}: no se ha podido leer (${e.message})`));
      }
    }
  } else if (usarIa) {
    console.log(C.gris('    sin PDF: las explicaciones saldrán sólo del modelo'));
  }

  const cuenta = { nuevas: 0, actualizadas: 0, duplicadas: 0, problemas: 0, conExplicacion: 0 };
  let numero = siguienteNumero(preguntas, modulo.id);

  for (const nombreImagen of imagenes) {
    const ruta = path.join(rutaTema, nombreImagen);
    let extraida;
    let rescatadas = 0;
    let porVision = false;
    try {
      const img = leerImagen(ruta);
      const bandas = bandasVerdes(img);

      // --- Camino del lector de macOS ---
      // El mismo que usa Vista Previa. Lee el texto sobre fondo de color sin
      // despeinarse, así que no necesita ninguna de las muletas de Tesseract.
      let delOcr = null;
      if (op.motor === 'macos' || op.motor === 'macos-ia') {
        const lineas = ocrLineasMacOS(ruta);
        delOcr = extraerPregunta(lineas, bandas);
        extraida = delOcr;
      }

      // --- Camino de Tesseract ---
      if (op.motor === 'ocr' || op.motor === 'ambos') {
        // Se lee la imagen ampliada al doble: sube la precisión del OCR de un
        // 82 % a un 94 % en capturas de pantalla y recupera las tildes.
        const ampliada = ampliarParaOcr(img, ESCALA_OCR);
        const lineas = ocrLineas(ampliada, {
          idioma: op.idioma, tessdata: op.tessdata, escala: ESCALA_OCR,
        });
        delOcr = extraerPregunta(lineas, bandas);

        // Segunda pasada: la opción correcta va en texto blanco sobre verde y a
        // menudo el OCR no la ve. Si falta, se recorta esa zona y se relee con
        // el contraste invertido.
        if (delOcr.correcta === null && bandas.length) {
          const extra = rescatarZonasVerdes(img, bandas, lineas,
            { idioma: op.idioma, tessdata: op.tessdata });
          if (extra.length) {
            const juntas = [...lineas, ...extra].sort((a, b) => a.arriba - b.arriba);
            const segunda = extraerPregunta(juntas, bandas);
            if (segunda.correcta !== null && segunda.opciones.length >= 2) {
              delOcr = segunda;
              rescatadas = extra.length;
            }
          }
        }
        extraida = delOcr;
      }

      // --- Camino del modelo de visión ---
      // Con "macos-ia" sólo se molesta al modelo si el lector de macOS se ha
      // quedado corto. Así se aprovecha su velocidad sin renunciar al rescate.
      const rescatarConIa = op.motor === 'macos-ia' && !completa(delOcr);
      if (op.motor === 'vision' || op.motor === 'ambos' || rescatarConIa) {
        const deVision = await extraerConVision(ruta, { url: op.url, modelo: op.modeloVision });
        porVision = true;
        // Cuando hay dos lecturas: el texto lo pone el modelo, la respuesta
        // correcta la pone el verde, que es el único que no se equivoca.
        extraida = (op.motor === 'ambos' || rescatarConIa)
          ? combinar(deVision, delOcr)
          : deVision;
      }
    } catch (e) {
      console.log(C.rojo(`    ✗ ${nombreImagen}: ${e.message}`));
      cuenta.problemas++;
      continue;
    }

    if (!extraida.pregunta || extraida.opciones.length < 2) {
      console.log(C.rojo(`    ✗ ${nombreImagen}: ${extraida.avisos.join(' ') || 'no se ha podido leer'}`));
      cuenta.problemas++;
      continue;
    }

    const provisional = { ...extraida };
    const k = clave(provisional);
    // ¿Ya estaba? Con --forzar se rehace en su sitio, sin duplicar.
    const yaEstaba = preguntas.findIndex((x) => clave(x) === k);
    if (yaEstaba >= 0 && !op.forzar) { cuenta.duplicadas++; continue; }

    const p = {
      id: yaEstaba >= 0
        ? preguntas[yaEstaba].id
        : `${modulo.id}-${String(numero++).padStart(4, '0')}`,
      moduloId: modulo.id,
      modulo: modulo.nombre,
      submoduloId: slug(nombreTema),
      submodulo: nombreTema,
      idExterno: extraida.idExterno,
      pregunta: extraida.pregunta,
      opciones: extraida.opciones,
      correcta: extraida.correcta,
      explicacion: '',
      ejemplo: '',
      revisado: false,
      material: { pdf: null, pagina: null, video: null, minuto: null, audio: null },
      tags: [],
      origen: nombreImagen,
      confianzaOcr: extraida.conf,
    };

    const avisos = [...extraida.avisos];

    // Sin marca verde no inventamos: se deja en la primera y se avisa.
    if (p.correcta === null) {
      p.correcta = 0;
      avisos.push('SIN RESPUESTA CORRECTA DETECTADA: márcala a mano.');
    }

    // --- Explicación apoyada en el temario ---
    let apoyo = '';
    if (usarIa) {
      const consulta = `${p.pregunta} ${p.opciones[p.correcta]}`;
      const contexto = trozos.length ? buscarRelevantes(trozos, consulta, { cuantos: 2 }) : [];
      apoyo = contexto.length
        ? ` · con el temario (pág. ${contexto.map((c) => c.pagina).join(', ')})`
        : trozos.length
          ? ' · sin pasajes del temario para esta'
          : ' · sin PDF';
      try {
        const bruto = await generar(p, contexto, { url: op.url, modelo: op.modelo });
        const campos = extraerCampos(bruto);
        if (campos) {
          p.explicacion = campos.explicacion;
          p.ejemplo = campos.ejemplo;
          cuenta.conExplicacion++;
          if (contexto.length) {
            p.material.pdf = pdfs[0] || null;
            p.material.pagina = contexto[0].pagina;
          }
        } else {
          const muestra = bruto
            ? bruto.replace(/\s+/g, ' ').slice(0, 160) + (bruto.length > 160 ? '…' : '')
            : '(respuesta vacía)';
          avisos.push(`No se ha podido aprovechar la explicación. El modelo dijo: ${muestra}`);
        }
      } catch (e) {
        avisos.push(`Fallo al generar la explicación: ${e.message}`);
      }
    }

    p.motor = op.motor;
    const marca = yaEstaba >= 0 ? '↻' : '✓';
    if (avisos.length) {
      cuenta.problemas++;
      console.log(C.ambar(`    ! ${nombreImagen} → ${p.id}`));
      avisos.forEach((a) => console.log(C.gris(`        ${a}`)));
    } else {
      const extra = rescatadas ? C.azul(' · rescatada del verde')
        : porVision ? C.azul(' · leída por el modelo') : '';
      const conTemario = /temario/.test(apoyo) ? C.verde(apoyo) : C.gris(apoyo);
      console.log(C.gris(`    ${marca} ${nombreImagen} → ${p.id} · ${p.opciones.length} opciones · ${'ABCD'[p.correcta]} correcta`) + extra + conTemario);
    }

    if (yaEstaba >= 0) {
      preguntas[yaEstaba] = p;
      cuenta.actualizadas++;
    } else {
      preguntas.push(p);
      vistos.add(k);
      cuenta.nuevas++;
    }
  }

  resumen.push({ tema: `${modulo.id} / ${nombreTema}`, ...cuenta });
}

principal().catch((e) => {
  console.error(C.rojo('\nError inesperado: ' + e.stack));
  process.exit(1);
});
