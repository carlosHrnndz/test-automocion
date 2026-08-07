// ---------------------------------------------------------------------------
// Lectura y escritura del banco de preguntas (public/data).
//
// El panel trabaja directamente sobre estos archivos: no hay exportar ni
// importar, lo que ves en pantalla es lo que se publica.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESTRUCTURA, slug } from '../src/lib/estructura.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATOS = path.join(RAIZ, 'public', 'data');
const PREGUNTAS = path.join(DATOS, 'preguntas');
const AJUSTES = path.join(RAIZ, '.panel.json');

// --- Ajustes del panel (carpetas recientes, modelo elegido) -----------------

// Por defecto se lee con el modelo de visión y se usa Gemma para todo: ve
// imágenes y responde directo, sin gastar tiempo razonando como hacen qwen3
// y compañía.
const POR_DEFECTO = {
  carpetasRecientes: [],
  motor: 'macos',
  modelo: 'gemma4:latest',
  modeloVision: 'gemma4:latest',
  urlOllama: 'http://localhost:11434',
};

export function leerAjustes() {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(fs.readFileSync(AJUSTES, 'utf8')) };
  } catch {
    return { ...POR_DEFECTO };
  }
}

export function guardarAjustes(parcial) {
  const nuevos = { ...leerAjustes(), ...parcial };
  fs.writeFileSync(AJUSTES, JSON.stringify(nuevos, null, 2));
  return nuevos;
}

export function recordarCarpeta(ruta) {
  const a = leerAjustes();
  const lista = [ruta, ...(a.carpetasRecientes || []).filter((r) => r !== ruta)].slice(0, 8);
  return guardarAjustes({ carpetasRecientes: lista });
}

// --- Banco ------------------------------------------------------------------

export function leerModulo(moduloId) {
  const f = path.join(PREGUNTAS, `${moduloId}.json`);
  if (!fs.existsSync(f)) return [];
  try {
    const datos = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function escribirModulo(moduloId, preguntas) {
  fs.mkdirSync(PREGUNTAS, { recursive: true });
  const f = path.join(PREGUNTAS, `${moduloId}.json`);
  if (!preguntas.length) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } else {
    fs.writeFileSync(f, JSON.stringify(preguntas, null, 2) + '\n');
  }
  actualizarManifiesto();
}

export function modulosConArchivo() {
  if (!fs.existsSync(PREGUNTAS)) return [];
  return fs.readdirSync(PREGUNTAS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

export function actualizarManifiesto() {
  const presentes = modulosConArchivo();
  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(path.join(DATOS, 'manifest.json'), JSON.stringify({
    titulacion: 'Técnico Superior en Automoción',
    version: 1,
    actualizado: new Date().toISOString().slice(0, 10),
    modulos: ESTRUCTURA.filter((m) => presentes.includes(m.id))
      .map((m) => ({ id: m.id, archivo: `preguntas/${m.id}.json` })),
  }, null, 2) + '\n');
}

/** Todas las preguntas del banco, de todos los módulos. */
export function leerTodo() {
  return modulosConArchivo().flatMap((id) => leerModulo(id));
}

export function resumenBanco() {
  const porModulo = ESTRUCTURA.map((m) => {
    const lista = leerModulo(m.id);
    return {
      id: m.id,
      nombre: m.nombre,
      corto: m.corto,
      color: m.color,
      total: lista.length,
      conExplicacion: lista.filter((p) => p.explicacion).length,
      sinRevisar: lista.filter((p) => p.explicacion && !p.revisado).length,
      sinCorrecta: lista.filter((p) => p.correcta === null || p.correcta === undefined).length,
      temas: [...new Set(lista.map((p) => p.submodulo))].length,
    };
  }).filter((m) => m.total > 0);

  return {
    porModulo,
    total: porModulo.reduce((n, m) => n + m.total, 0),
    sinRevisar: porModulo.reduce((n, m) => n + m.sinRevisar, 0),
    sinExplicacion: porModulo.reduce((n, m) => n + (m.total - m.conExplicacion), 0),
  };
}

/** Guarda una pregunta ya existente, localizándola por su id. */
export function guardarPregunta(pregunta) {
  const lista = leerModulo(pregunta.moduloId);
  const i = lista.findIndex((p) => p.id === pregunta.id);
  if (i === -1) throw new Error(`No existe la pregunta ${pregunta.id}`);
  lista[i] = { ...lista[i], ...pregunta };
  escribirModulo(pregunta.moduloId, lista);
  return lista[i];
}

/**
 * Cambia el tema (submódulo) de varias preguntas de golpe.
 *
 * Pensado para cuando se añaden preguntas a mano y se olvida ponerlo: quedan
 * en "Sin clasificar" y desde la app no hay forma de filtrarlas por tema.
 * No mueve nada de módulo, así que los identificadores no cambian.
 */
export function reclasificar(ids, submodulo) {
  const nombre = String(submodulo || '').trim();
  if (!nombre) throw new Error('Falta el tema');

  const objetivo = new Set(ids);
  let n = 0;
  for (const moduloId of modulosConArchivo()) {
    const lista = leerModulo(moduloId);
    let tocado = false;
    for (const p of lista) {
      if (!objetivo.has(p.id)) continue;
      p.submodulo = nombre;
      p.submoduloId = slug(nombre);
      tocado = true;
      n++;
    }
    if (tocado) escribirModulo(moduloId, lista);
  }
  return n;
}

/**
 * Marca (o desmarca) como revisadas varias preguntas de golpe.
 * Sólo cuentan las que tienen explicación: marcar como revisada algo que está
 * vacío no significa nada y falsearía el recuento del panel.
 */
export function marcarRevisadas(ids, revisado = true) {
  const objetivo = new Set(ids);
  let n = 0, sinExplicacion = 0;
  for (const moduloId of modulosConArchivo()) {
    const lista = leerModulo(moduloId);
    let tocado = false;
    for (const p of lista) {
      if (!objetivo.has(p.id)) continue;
      if (revisado && !p.explicacion) { sinExplicacion++; continue; }
      p.revisado = !!revisado;
      tocado = true;
      n++;
    }
    if (tocado) escribirModulo(moduloId, lista);
  }
  return { cambiadas: n, sinExplicacion };
}

/**
 * Guarda el esquema de una pregunta como archivo suelto y devuelve la ruta
 * relativa que hay que meter en el campo `imagen`.
 *
 * Aparte y no dentro del JSON: así el archivo de preguntas no se hincha, el
 * navegador puede guardarlo en su caché por separado, y se puede mirar o
 * borrar a mano si alguno sale mal.
 */
export function guardarEsquema(id, svg) {
  const limpio = String(id).replace(/[^\w-]/g, '');
  if (!limpio) throw new Error('Identificador de pregunta no válido');
  const dir = path.join(DATOS, 'esquemas');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${limpio}.svg`), svg);
  return `data/esquemas/${limpio}.svg`;
}

// --- Ilustraciones sueltas en public/images ---------------------------------
//
// Aparte del circuito de láminas SVG que dibuja el programa, se pueden dejar
// imágenes hechas por fuera —a mano, con una IA, escaneadas— en public/images
// con el nombre de la pregunta a la que acompañan. Esta parte las localiza y
// las apunta en su pregunta, sin tener que tocar el JSON.

export const IMAGENES = path.join(RAIZ, 'public', 'images');

const EXTENSIONES = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'];

/**
 * Del nombre de un archivo al identificador de una pregunta.
 *
 * Tolerante a propósito: cfsd_0007.png, CFSD-0007.PNG y cfsd 0007.webp son
 * todos la pregunta cfsd-0007. Nombrar archivos a mano es fácil equivocarse y
 * no merece la pena que una imagen se pierda por un guion bajo.
 */
export function idDeArchivo(archivo) {
  const base = archivo.replace(/\.[^.]+$/, '');
  return base.trim().toLowerCase().replace(/[\s_.]+/g, '-');
}

/** Lista los archivos de imagen que hay ahora mismo en public/images. */
export function listarImagenes() {
  if (!fs.existsSync(IMAGENES)) return [];
  return fs
    .readdirSync(IMAGENES)
    .filter((f) => !f.startsWith('.') && EXTENSIONES.includes(path.extname(f).toLowerCase()))
    .sort();
}

/**
 * Empareja cada imagen de public/images con su pregunta y la apunta en el
 * campo `imagen`.
 *
 * Devuelve el parte completo, porque lo interesante no es cuántas ha puesto
 * sino cuáles se han quedado fuera: un archivo mal nombrado se ve enseguida
 * en la lista de "sin pregunta".
 */
export function vincularImagenes() {
  const archivos = listarImagenes();
  const porId = new Map();
  for (const f of archivos) {
    const id = idDeArchivo(f);
    // Si hay dos archivos para la misma pregunta gana el primero por orden
    // alfabético, y el otro se avisa como repetido.
    if (porId.has(id)) porId.get(id).push(f);
    else porId.set(id, [f]);
  }

  const puestas = [];
  const yaEstaban = [];
  const repetidas = [];
  const usados = new Set();

  for (const moduloId of modulosConArchivo()) {
    const lista = leerModulo(moduloId);
    let tocado = false;
    for (const p of lista) {
      const grupo = porId.get(String(p.id).toLowerCase());
      if (!grupo) continue;
      usados.add(String(p.id).toLowerCase());
      if (grupo.length > 1) repetidas.push({ id: p.id, archivos: grupo });
      const ruta = `images/${grupo[0]}`;
      if (p.imagen === ruta) { yaEstaban.push(p.id); continue; }
      p.imagen = ruta;
      puestas.push({ id: p.id, archivo: grupo[0] });
      tocado = true;
    }
    if (tocado) escribirModulo(moduloId, lista);
  }

  const sinPregunta = [...porId.entries()]
    .filter(([id]) => !usados.has(id))
    .flatMap(([, archivos]) => archivos);

  return { total: archivos.length, puestas, yaEstaban, repetidas, sinPregunta };
}

/**
 * Quita la referencia a la imagen de una pregunta.
 * No borra el archivo: lo puso el usuario y puede querer volver a enlazarlo.
 */
export function desvincularImagen(id) {
  for (const moduloId of modulosConArchivo()) {
    const lista = leerModulo(moduloId);
    const p = lista.find((q) => q.id === id);
    if (!p) continue;
    delete p.imagen;
    escribirModulo(moduloId, lista);
    return true;
  }
  return false;
}

/** Quita el esquema de una pregunta, si lo tenía. */
export function borrarEsquema(id) {
  const limpio = String(id).replace(/[^\w-]/g, '');
  try { fs.rmSync(path.join(DATOS, 'esquemas', `${limpio}.svg`), { force: true }); }
  catch { /* no existía: da igual */ }
}

export function borrarPreguntas(ids) {
  for (const id of ids) borrarEsquema(id);
  const porBorrar = new Set(ids);
  let n = 0;
  for (const moduloId of modulosConArchivo()) {
    const lista = leerModulo(moduloId);
    const quedan = lista.filter((p) => !porBorrar.has(p.id));
    if (quedan.length !== lista.length) {
      n += lista.length - quedan.length;
      escribirModulo(moduloId, quedan);
    }
  }
  return n;
}

export function siguienteId(moduloId) {
  const usados = leerModulo(moduloId)
    .map((p) => Number(String(p.id).split('-').pop()))
    .filter((n) => Number.isFinite(n));
  return `${moduloId}-${String((usados.length ? Math.max(...usados) : 0) + 1).padStart(4, '0')}`;
}

/** Añade preguntas nuevas evitando duplicados. Devuelve cuántas han entrado. */
export function anadirPreguntas(moduloId, nuevas, clave) {
  const lista = leerModulo(moduloId);
  const vistos = new Set(lista.map(clave));
  let n = 0;
  let contador = Number(siguienteId(moduloId).split('-').pop());
  for (const p of nuevas) {
    if (vistos.has(clave(p))) continue;
    p.id = `${moduloId}-${String(contador++).padStart(4, '0')}`;
    lista.push(p);
    vistos.add(clave(p));
    n++;
  }
  if (n) escribirModulo(moduloId, lista);
  return n;
}
