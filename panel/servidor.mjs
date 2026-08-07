#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Panel de control local. Arranca un servidor en tu Mac y abre la interfaz
// en el navegador. Sustituye a todos los comandos del terminal.
//
//   npm run panel        (o doble clic en Panel.command)
//
// No expone nada fuera de tu ordenador: escucha sólo en 127.0.0.1.
// ---------------------------------------------------------------------------

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ESTRUCTURA } from '../src/lib/estructura.js';
import { analizar, clavePregunta } from '../herramientas/importador/texto.mjs';
import { hayTesseract, idiomasDisponibles } from '../herramientas/importador/ocr.mjs';
import { comprobarMacOS } from '../herramientas/importador/ocr-macos.mjs';
import { comprobarOllama, generar, extraerCampos } from '../herramientas/importador/ollama.mjs';
import { generarEsquema } from '../herramientas/importador/esquema.mjs';
import * as banco from './banco.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = banco.RAIZ;
const PUERTO = Number(process.env.PUERTO || 5174);
const EXT_IMAGEN = ['.png', '.jpg', '.jpeg'];

// --- Proceso largo en curso (importar, publicar, explicar) ------------------
// Sólo uno a la vez: simplifica el estado y evita pisarse los archivos.
let tarea = null;         // { nombre, proceso, lineas:[], terminado, codigo }
const oyentes = new Set(); // conexiones SSE

function emitir(evento, datos) {
  const mensaje = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of oyentes) {
    try { res.write(mensaje); } catch { oyentes.delete(res); }
  }
}

const SIN_COLOR = /\x1b\[[0-9;]*m/g;

function apuntar(texto) {
  for (const linea of String(texto).split('\n')) {
    const limpia = linea.replace(SIN_COLOR, '').trimEnd();
    if (!limpia.trim() && !tarea.lineas.length) continue;
    tarea.lineas.push(limpia);
    emitir('linea', { texto: limpia });
  }
}

function lanzar(nombre, comando, args, opciones = {}) {
  if (tarea && !tarea.terminado) throw new Error('Ya hay una tarea en marcha');
  tarea = { nombre, lineas: [], terminado: false, codigo: null, inicio: Date.now() };
  emitir('inicio', { nombre });

  const proceso = spawn(comando, args, { cwd: RAIZ, ...opciones });
  tarea.proceso = proceso;
  proceso.stdout.on('data', (d) => apuntar(d.toString()));
  proceso.stderr.on('data', (d) => apuntar(d.toString()));
  proceso.on('close', (codigo) => {
    tarea.terminado = true;
    tarea.codigo = codigo;
    emitir('fin', { nombre, codigo, segundos: Math.round((Date.now() - tarea.inicio) / 1000) });
  });
  proceso.on('error', (e) => {
    apuntar('No se ha podido ejecutar: ' + e.message);
    tarea.terminado = true;
    tarea.codigo = -1;
    emitir('fin', { nombre, codigo: -1 });
  });
  return tarea;
}

/** Para tareas que hacemos aquí mismo en vez de lanzar un proceso. */
function tareaPropia(nombre) {
  if (tarea && !tarea.terminado) throw new Error('Ya hay una tarea en marcha');
  tarea = { nombre, lineas: [], terminado: false, codigo: null, inicio: Date.now(), propia: true };
  emitir('inicio', { nombre });
  return {
    log: (t) => apuntar(t),
    fin: (codigo = 0) => {
      tarea.terminado = true;
      tarea.codigo = codigo;
      emitir('fin', { nombre, codigo, segundos: Math.round((Date.now() - tarea.inicio) / 1000) });
    },
  };
}

// --- Servidor de desarrollo de la app (npm run dev) -------------------------
let procesoDev = null;
let urlDev = null;

// --- Utilidades -------------------------------------------------------------

function json(res, datos, codigo = 200) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(cuerpo);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (c) => {
      datos += c;
      if (datos.length > 20e6) reject(new Error('Cuerpo demasiado grande'));
    });
    req.on('end', () => {
      try { resolve(datos ? JSON.parse(datos) : {}); } catch (e) { reject(e); }
    });
  });
}

const ejecutar = (comando, args, opciones = {}) => new Promise((resolve) => {
  execFile(comando, args, { cwd: RAIZ, ...opciones }, (error, stdout, stderr) =>
    resolve({ ok: !error, salida: (stdout || '') + (stderr || '') }));
});

function contar(dir, extensiones) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('.') &&
                     extensiones.includes(path.extname(e.name).toLowerCase())).length;
  } catch { return 0; }
}

function subcarpetas(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'es'));
  } catch { return []; }
}

/**
 * Saca el JSON de una respuesta de modelo, aguantando la basura de alrededor.
 * Los modelos pequeños casi nunca devuelven JSON limpio: meten ```json, un
 * "Aquí tienes:" delante, o varios objetos seguidos sin corchetes.
 */
export function extraerJsonSuelto(texto) {
  let t = String(texto)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  // Sólo nos vale un objeto o una lista de objetos. Una lista de textos sería
  // el array "opciones" de dentro de una pregunta, no la lista de preguntas.
  const esUtil = (v) => v && typeof v === 'object' &&
    (!Array.isArray(v) || v.every((x) => x && typeof x === 'object' && !Array.isArray(x)));

  // ¿Es JSON válido tal cual?
  try {
    const v = JSON.parse(t);
    if (esUtil(v)) return v;
  } catch { /* seguimos intentando */ }

  // ¿Hay una lista de preguntas dentro?
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a !== -1 && b > a) {
    try {
      const v = JSON.parse(t.slice(a, b + 1));
      if (esUtil(v) && Array.isArray(v) && v.length) return v;
    } catch { /* seguimos */ }
  }

  // Uno o varios objetos sueltos: los recogemos contando llaves.
  const objetos = [];
  let profundidad = 0, inicio = -1, enTexto = false, escapado = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enTexto) {
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === '"') enTexto = false;
      continue;
    }
    if (c === '"') { enTexto = true; continue; }
    if (c === '{') { if (profundidad === 0) inicio = i; profundidad++; }
    else if (c === '}') {
      profundidad--;
      if (profundidad === 0 && inicio !== -1) {
        try { objetos.push(JSON.parse(t.slice(inicio, i + 1))); } catch { /* ese no */ }
        inicio = -1;
      }
    }
  }
  if (objetos.length === 1) return objetos[0];
  if (objetos.length > 1) return objetos;
  throw new Error('no se ha encontrado ningún objeto JSON');
}

// --- Buscar una copia más reciente del proyecto -----------------------------
//
// Se compara el CONTENIDO de los archivos, no su fecha. Las fechas no valen:
// rsync no las copia con precisión exacta y quedan diferencias de milisegundos
// que hacían creer que siempre había una versión nueva.

const CARPETAS_CODIGO = ['herramientas', 'panel', 'src'];
const ARCHIVOS_CODIGO = ['package.json', 'index.html', 'vite.config.js', 'Panel.command'];

/** Mapa de "ruta relativa" -> huella del contenido, para todo el código. */
function huellaCodigo(base) {
  const huellas = new Map();

  const anotar = (completa) => {
    const rel = path.relative(base, completa);
    try {
      huellas.set(rel, crypto.createHash('sha1').update(fs.readFileSync(completa)).digest('hex'));
    } catch { /* archivo ilegible: se ignora */ }
  };

  for (const archivo of ARCHIVOS_CODIGO) {
    const completa = path.join(base, archivo);
    if (fs.existsSync(completa)) anotar(completa);
  }

  for (const sub of CARPETAS_CODIGO) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) continue;
    const pila = [dir];
    while (pila.length) {
      const actual = pila.pop();
      let entradas;
      try { entradas = fs.readdirSync(actual, { withFileTypes: true }); } catch { continue; }
      for (const e of entradas) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const completa = path.join(actual, e.name);
        if (e.isDirectory()) pila.push(completa);
        else anotar(completa);
      }
    }
  }
  return huellas;
}

/** Qué archivos cambian entre dos copias del proyecto. */
function compararCodigo(origen, destino) {
  const a = huellaCodigo(origen);
  const b = huellaCodigo(destino);
  const cambios = [];
  for (const [rel, huella] of a) {
    if (!b.has(rel)) cambios.push({ archivo: rel, tipo: 'nuevo' });
    else if (b.get(rel) !== huella) cambios.push({ archivo: rel, tipo: 'cambiado' });
  }
  return cambios;
}

/** Fecha del archivo de código más reciente. Sólo para ordenar candidatos. */
function fechaCodigo(base) {
  let ultima = 0;
  for (const sub of CARPETAS_CODIGO) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) continue;
    const pila = [dir];
    while (pila.length) {
      const actual = pila.pop();
      let entradas;
      try { entradas = fs.readdirSync(actual, { withFileTypes: true }); } catch { continue; }
      for (const e of entradas) {
        if (e.name.startsWith('.')) continue;
        const completa = path.join(actual, e.name);
        if (e.isDirectory()) pila.push(completa);
        else ultima = Math.max(ultima, fs.statSync(completa).mtimeMs);
      }
    }
  }
  return ultima;
}

/** Localiza la copia del proyecto que ha dejado Cowork, si existe. */
function buscarOrigen() {
  const raizCowork = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  if (!fs.existsSync(raizCowork)) return null;

  const candidatos = [];
  const buscar = (dir, profundidad) => {
    if (profundidad > 5) return;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const completa = path.join(dir, e.name);
      if (e.name === 'test-automocion' && fs.existsSync(path.join(completa, 'package.json'))) {
        if (path.resolve(completa) !== path.resolve(RAIZ)) {
          candidatos.push({ ruta: completa, fecha: fechaCodigo(completa) });
        }
      } else {
        buscar(completa, profundidad + 1);
      }
    }
  };
  buscar(raizCowork, 0);

  candidatos.sort((a, b) => b.fecha - a.fecha);
  return candidatos[0] || null;
}

// --- API --------------------------------------------------------------------

const rutas = {

  // Estado general: lo que la interfaz necesita para pintarse.
  async 'GET /api/estado'(req, res) {
    const ajustes = banco.leerAjustes();
    let ollama = { ok: false, modelos: [] };
    try {
      ollama = { ok: true, modelos: await comprobarOllama(ajustes.urlOllama) };
    } catch { /* Ollama apagado: no es un error, sólo una capacidad menos */ }

    const git = await ejecutar('git', ['status', '--porcelain']);
    const rama = await ejecutar('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    const remoto = await ejecutar('git', ['remote', 'get-url', 'origin']);
    // Para la primera publicación hace falta saber qué tiene ya montado:
    // si git sabe quién eres y si tiene la herramienta oficial de GitHub,
    // que evita tener que crear el repositorio a mano en la web.
    const nombre = await ejecutar('git', ['config', 'user.name']);
    const correo = await ejecutar('git', ['config', 'user.email']);
    const gh = await ejecutar('gh', ['auth', 'status']);

    json(res, {
      banco: banco.resumenBanco(),
      modulos: ESTRUCTURA.map((m) => ({
        id: m.id, nombre: m.nombre, corto: m.corto, color: m.color,
        submodulos: m.submodulos || [],
      })),
      tesseract: { ok: hayTesseract(), idiomas: hayTesseract() ? idiomasDisponibles() : [] },
      macos: comprobarMacOS(),
      // Cuántas imágenes hay sueltas en public/images y cuántas están ya
      // apuntadas en su pregunta. La diferencia es lo que falta por enlazar.
      imagenes: (() => {
        const archivos = banco.listarImagenes();
        const enlazadas = new Set(
          banco.leerTodo()
            .map((p) => p.imagen)
            .filter((r) => typeof r === 'string' && r.startsWith('images/'))
            .map((r) => r.slice('images/'.length))
        );
        return {
          total: archivos.length,
          enlazadas: archivos.filter((f) => enlazadas.has(f)).length,
        };
      })(),
      ollama,
      git: {
        esRepo: git.ok,
        cambios: git.ok ? git.salida.split('\n').filter(Boolean).length : 0,
        // Separado para poder decir en claro qué se va a subir: las preguntas
        // o el programa. Cuando no cuadraban los números no había quien lo
        // entendiera.
        ...(() => {
          const lineas = git.ok ? git.salida.split('\n').filter(Boolean) : [];
          const esBanco = (l) => l.slice(3).replace(/^"|"$/g, '').startsWith('public/data/');
          return {
            cambiosBanco: lineas.filter(esBanco).length,
            cambiosPrograma: lineas.filter((l) => !esBanco(l)).length,
          };
        })(),
        rama: rama.ok ? rama.salida.trim() : null,
        remoto: remoto.ok ? remoto.salida.trim() : null,
        identidad: nombre.ok && correo.ok && nombre.salida.trim() && correo.salida.trim()
          ? { nombre: nombre.salida.trim(), correo: correo.salida.trim() } : null,
        gh: gh.ok,
        carpeta: path.basename(RAIZ),
      },
      ajustes,
      dev: { activo: !!procesoDev, url: urlDev },
      tarea: tarea ? { nombre: tarea.nombre, terminado: tarea.terminado, codigo: tarea.codigo } : null,
      inicio: os.homedir(),
    });
  },

  // Explorador de carpetas.
  async 'GET /api/explorar'(req, res, url) {
    let ruta = url.searchParams.get('ruta') || os.homedir();
    ruta = path.resolve(ruta.replace(/^~/, os.homedir()));
    if (!fs.existsSync(ruta) || !fs.statSync(ruta).isDirectory()) {
      return json(res, { error: 'No existe esa carpeta' }, 404);
    }

    const hijas = subcarpetas(ruta).map((nombre) => {
      const completa = path.join(ruta, nombre);
      return {
        nombre,
        ruta: completa,
        imagenes: contar(completa, EXT_IMAGEN),
        pdfs: contar(completa, ['.pdf']),
        subcarpetas: subcarpetas(completa).length,
      };
    });

    const imagenes = contar(ruta, EXT_IMAGEN);
    const nivel = imagenes > 0
      ? 'tema'
      : hijas.some((h) => h.imagenes > 0) ? 'modulo' : hijas.length ? 'raiz' : 'vacio';

    json(res, {
      ruta,
      padre: path.dirname(ruta) === ruta ? null : path.dirname(ruta),
      nombre: path.basename(ruta) || ruta,
      imagenes,
      pdfs: contar(ruta, ['.pdf']),
      carpetas: hijas,
      nivel,
      totalImagenes: imagenes + hijas.reduce((n, h) => n + h.imagenes, 0) +
        hijas.reduce((n, h) => n + subcarpetas(h.ruta)
          .reduce((m, s) => m + contar(path.join(h.ruta, s), EXT_IMAGEN), 0), 0),
    });
  },

  // Lanzar el importador.
  async 'POST /api/importar'(req, res) {
    const cuerpo = await leerCuerpo(req);
    if (!cuerpo.carpeta) return json(res, { error: 'Falta la carpeta' }, 400);

    const args = ['herramientas/importar.mjs', cuerpo.carpeta];
    if (cuerpo.sinIa) args.push('--sin-ia');
    if (cuerpo.limpiar) args.push('--limpiar');
    if (cuerpo.forzar) args.push('--forzar');
    if (cuerpo.modulo) args.push('--modulo', cuerpo.modulo);
    if (cuerpo.limite) args.push('--limite', String(cuerpo.limite));
    if (cuerpo.modelo) args.push('--modelo', cuerpo.modelo);
    if (cuerpo.motor) args.push('--motor', cuerpo.motor);
    if (cuerpo.modeloVision) args.push('--modelo-vision', cuerpo.modeloVision);
    // Para instalaciones de Tesseract fuera de lo normal (y para las pruebas).
    if (process.env.TESSDATA_DIR) args.push('--tessdata', process.env.TESSDATA_DIR);

    banco.recordarCarpeta(cuerpo.carpeta);
    try {
      lanzar('Importar capturas', process.execPath, args);
      json(res, { ok: true });
    } catch (e) {
      json(res, { error: e.message }, 409);
    }
  },

  // Registro en vivo (Server-Sent Events).
  async 'GET /api/log'(req, res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    if (tarea) {
      res.write(`event: historial\ndata: ${JSON.stringify({
        nombre: tarea.nombre, lineas: tarea.lineas, terminado: tarea.terminado, codigo: tarea.codigo,
      })}\n\n`);
    }
    oyentes.add(res);
    req.on('close', () => oyentes.delete(res));
  },

  async 'POST /api/parar'(req, res) {
    if (tarea?.proceso && !tarea.terminado) tarea.proceso.kill('SIGTERM');
    else if (tarea && !tarea.terminado) { tarea.cancelada = true; }
    json(res, { ok: true });
  },

  // --- Banco ---------------------------------------------------------------

  async 'GET /api/preguntas'(req, res, url) {
    const moduloId = url.searchParams.get('modulo');
    const lista = moduloId ? banco.leerModulo(moduloId) : banco.leerTodo();
    json(res, { preguntas: lista });
  },

  async 'PUT /api/pregunta'(req, res) {
    const p = await leerCuerpo(req);
    try { json(res, { pregunta: banco.guardarPregunta(p) }); }
    catch (e) { json(res, { error: e.message }, 400); }
  },

  // Poner (o corregir) el tema de varias preguntas a la vez.
  async 'POST /api/reclasificar'(req, res) {
    const { ids = [], submodulo = '' } = await leerCuerpo(req);
    if (!ids.length) return json(res, { error: 'No has seleccionado ninguna pregunta' }, 400);
    try { json(res, { cambiadas: banco.reclasificar(ids, submodulo) }); }
    catch (e) { json(res, { error: e.message }, 400); }
  },

  // Dar por buenas varias explicaciones a la vez.
  async 'POST /api/revisadas'(req, res) {
    const { ids = [], revisado = true } = await leerCuerpo(req);
    if (!ids.length) return json(res, { error: 'No has seleccionado ninguna pregunta' }, 400);
    json(res, banco.marcarRevisadas(ids, revisado));
  },

  async 'POST /api/borrar'(req, res) {
    const { ids = [] } = await leerCuerpo(req);
    json(res, { borradas: banco.borrarPreguntas(ids) });
  },

  // --- Pegar texto a mano --------------------------------------------------

  async 'POST /api/analizar'(req, res) {
    const { texto = '' } = await leerCuerpo(req);
    const { preguntas, incidencias } = analizar(texto);
    json(res, { preguntas, incidencias });
  },

  async 'POST /api/anadir'(req, res) {
    const { moduloId, submodulo, preguntas = [] } = await leerCuerpo(req);
    const modulo = ESTRUCTURA.find((m) => m.id === moduloId);
    if (!modulo) return json(res, { error: 'Módulo desconocido' }, 400);

    const slug = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

    const preparadas = preguntas.map((p) => ({
      moduloId,
      modulo: modulo.nombre,
      submoduloId: submodulo ? slug(submodulo) : 'sin-clasificar',
      submodulo: submodulo || 'Sin clasificar',
      idExterno: p.idExterno || null,
      pregunta: p.pregunta,
      opciones: p.opciones,
      correcta: p.correcta ?? 0,
      explicacion: p.explicacion || '',
      ejemplo: p.ejemplo || '',
      revisado: false,
      material: { pdf: null, pagina: null, video: null, minuto: null, audio: null },
      tags: [],
    }));

    json(res, { anadidas: banco.anadirPreguntas(moduloId, preparadas, clavePregunta) });
  },

  // --- Pegar JSON venido de un modelo de visión ----------------------------
  //
  // Acepta lo que devuelva Ollama al mirar una captura: un objeto o una lista.
  // Es tolerante con la basura de alrededor (```json, texto suelto) porque los
  // modelos pequeños casi nunca devuelven JSON limpio del todo.

  async 'POST /api/pegar-json'(req, res) {
    const { texto = '', moduloId: moduloPorDefecto, submodulo: submoduloPorDefecto } = await leerCuerpo(req);

    let datos;
    try {
      datos = extraerJsonSuelto(texto);
    } catch (e) {
      return json(res, { error: 'No se ha encontrado un JSON válido: ' + e.message }, 400);
    }

    const entrantes = Array.isArray(datos) ? datos : [datos];
    const slug = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

    const problemas = [];
    const porModulo = new Map();

    entrantes.forEach((p, i) => {
      const donde = `Pregunta ${i + 1}`;
      if (!p || typeof p !== 'object') return problemas.push(`${donde}: no es un objeto.`);
      if (!p.pregunta) return problemas.push(`${donde}: falta el enunciado.`);
      if (!Array.isArray(p.opciones) || p.opciones.length < 2) {
        return problemas.push(`${donde}: hacen falta al menos 2 opciones.`);
      }
      const moduloId = p.moduloId || moduloPorDefecto;
      const modulo = ESTRUCTURA.find((m) => m.id === moduloId);
      if (!modulo) return problemas.push(`${donde}: módulo desconocido "${moduloId}".`);

      const correcta = Number.isInteger(p.correcta) ? p.correcta : null;
      if (correcta !== null && (correcta < 0 || correcta >= p.opciones.length)) {
        return problemas.push(`${donde}: la correcta (${correcta}) no existe entre las opciones.`);
      }

      const submodulo = p.submodulo || submoduloPorDefecto || 'Sin clasificar';
      const preparada = {
        moduloId,
        modulo: modulo.nombre,
        submoduloId: slug(submodulo),
        submodulo,
        idExterno: p.idExterno ? String(p.idExterno).replace(/\D/g, '') || null : null,
        pregunta: String(p.pregunta).trim(),
        opciones: p.opciones.map((o) => String(o).trim()),
        correcta: correcta ?? 0,
        explicacion: String(p.explicacion || '').trim(),
        ejemplo: String(p.ejemplo || '').trim(),
        revisado: false,
        material: { pdf: null, pagina: null, video: null, minuto: null, audio: null },
        tags: [],
        origen: 'modelo de visión',
      };

      // Avisos que ayudan a saber cuál mirar primero.
      if (correcta === null) problemas.push(`${donde}: sin respuesta correcta; entra con la primera marcada.`);
      if (p.confianza && p.confianza !== 'alta') {
        problemas.push(`${donde}: el modelo dice confianza "${p.confianza}"${p.dudas ? ` (${p.dudas})` : ''}.`);
      }
      if (preparada.opciones.some((o) => /\[ILEGIBLE\]/i.test(o) || /\[ILEGIBLE\]/i.test(preparada.pregunta))) {
        problemas.push(`${donde}: hay partes marcadas como ilegibles.`);
      }

      if (!porModulo.has(moduloId)) porModulo.set(moduloId, []);
      porModulo.get(moduloId).push(preparada);
    });

    let anadidas = 0;
    for (const [moduloId, lista] of porModulo) {
      anadidas += banco.anadirPreguntas(moduloId, lista, clavePregunta);
    }

    json(res, { anadidas, leidas: entrantes.length, problemas });
  },

  // --- Explicaciones sin PDF (para las metidas a mano) ---------------------

  async 'POST /api/explicar'(req, res) {
    const cuerpo = await leerCuerpo(req);
    const ajustes = banco.guardarAjustes({ modelo: cuerpo.modelo || 'qwen3:4b' });
    let t;
    try { t = tareaPropia('Generar explicaciones'); }
    catch (e) { return json(res, { error: e.message }, 409); }
    json(res, { ok: true });

    (async () => {
      const pendientes = (cuerpo.modulo ? banco.leerModulo(cuerpo.modulo) : banco.leerTodo())
        .filter((p) => (cuerpo.soloVacias ? !p.explicacion : !p.revisado));

      if (!pendientes.length) { t.log('No hay ninguna pregunta que encaje.'); return t.fin(0); }
      t.log(`${pendientes.length} pregunta(s) con ${ajustes.modelo}.`);
      t.log('Sin PDF de apoyo: para explicaciones basadas en el temario, usa Importar con "rehacer".\n');

      let hechas = 0, fallos = 0;
      for (let i = 0; i < pendientes.length; i++) {
        if (tarea.cancelada) { t.log('Detenido.'); break; }
        const p = pendientes[i];
        const t0 = Date.now();
        try {
          const bruto = await generar(p, [], { url: ajustes.urlOllama, modelo: ajustes.modelo });
          const campos = extraerCampos(bruto);
          if (!campos) {
            // Enseñamos lo que ha contestado: sin esto es imposible saber por
            // qué falla, y "no respetó el formato" no le sirve a nadie.
            const muestra = bruto
              ? bruto.replace(/\s+/g, ' ').slice(0, 220) + (bruto.length > 220 ? '…' : '')
              : '(respuesta vacía)';
            t.log(`  ${i + 1}/${pendientes.length} · ${p.id} · no se ha podido aprovechar la respuesta`);
            t.log(`      el modelo dijo: ${muestra}`);
            fallos++;
            continue;
          }
          banco.guardarPregunta({ ...p, explicacion: campos.explicacion, ejemplo: campos.ejemplo, revisado: false });
          hechas++;
          t.log(`  ${i + 1}/${pendientes.length} · ${p.id} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        } catch (e) {
          fallos++;
          t.log(`  ${i + 1}/${pendientes.length} · ${p.id} · ERROR: ${e.message}`);
          if (/fetch failed|ECONNREFUSED/i.test(e.message)) {
            t.log('  Se ha perdido la conexión con Ollama. ¿Está abierto?');
            break;
          }
        }
      }

      if (fallos && !hechas) {
        t.log('\nNinguna ha salido. Suele ser el modelo elegido:');
        t.log(`  · "${ajustes.modelo}" puede no llevarse bien con instrucciones de formato.`);
        t.log('  · Prueba con gemma3:4b, que va muy fino para esto:  ollama pull gemma3:4b');
        t.log('  · Mira arriba qué contestó exactamente para hacerte una idea.');
      }
      t.log(`\nTerminado. ${hechas} con explicación${fallos ? `, ${fallos} con error` : ''}.`);
      t.log('Quedan marcadas como SIN REVISAR: repásalas en la pestaña Banco.');
      t.fin(0);
    })().catch((e) => { t.log('Error: ' + e.message); t.fin(1); });
  },

  // Meter en el banco láminas dibujadas fuera del programa.
  //
  // Se le da una carpeta con archivos .svg cuyo nombre es el identificador de
  // la pregunta (cfsd-0007.svg). Cada uno se copia a su sitio y se apunta en
  // la pregunta. Es el camino para las ilustraciones hechas a mano, una por
  // pregunta, sin tener que tocar el JSON.
  async 'POST /api/importar-laminas'(req, res) {
    const { carpeta } = await leerCuerpo(req);
    if (!carpeta) return json(res, { error: 'Falta la carpeta' }, 400);

    const dir = path.resolve(String(carpeta).replace(/^~/, os.homedir()));
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return json(res, { error: 'No existe esa carpeta' }, 400);
    }

    let t;
    try { t = tareaPropia('Meter las láminas'); }
    catch (e) { return json(res, { error: e.message }, 409); }
    json(res, { ok: true });

    (async () => {
      const ADMITIDAS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'];
      const archivos = fs.readdirSync(dir)
        .filter((f) => !f.startsWith('.') && ADMITIDAS.includes(path.extname(f).toLowerCase()));
      if (!archivos.length) {
        t.log('No hay ninguna imagen en esa carpeta.');
        t.log('Valen .svg, .png, .jpg, .webp, .avif y .gif.');
        return t.fin(0);
      }
      t.log(`${archivos.length} lámina(s) en ${dir}\n`);

      // Por identificador normalizado, para que dé igual cfsd_0007 que cfsd-0007.
      const porId = new Map(banco.leerTodo().map((p) => [String(p.id).toLowerCase(), p]));
      let puestas = 0, sinPregunta = 0, malas = 0;

      for (const archivo of archivos) {
        const id = banco.idDeArchivo(archivo);
        const pregunta = porId.get(id);
        if (!pregunta) {
          sinPregunta++;
          t.log(`  ✗ ${archivo} · no hay ninguna pregunta con ese identificador`);
          continue;
        }

        let ruta;
        if (path.extname(archivo).toLowerCase() === '.svg') {
          const svg = fs.readFileSync(path.join(dir, archivo), 'utf8');
          // Comprobación mínima: que sea un SVG y no un archivo cualquiera.
          if (!/^\s*<svg[\s>]/.test(svg) || !svg.includes('</svg>')) {
            malas++;
            t.log(`  ✗ ${archivo} · no parece un SVG`);
            continue;
          }
          ruta = banco.guardarEsquema(pregunta.id, svg);
        } else {
          // Las imágenes de mapa de bits van tal cual a public/images, con el
          // identificador de la pregunta por nombre.
          const destino = `${pregunta.id}${path.extname(archivo).toLowerCase()}`;
          fs.mkdirSync(banco.IMAGENES, { recursive: true });
          fs.copyFileSync(path.join(dir, archivo), path.join(banco.IMAGENES, destino));
          ruta = `images/${destino}`;
        }

        banco.guardarPregunta({ ...pregunta, imagen: ruta });
        puestas++;
        t.log(`  ✓ ${pregunta.id}`);
      }

      t.log(`\nTerminado. ${puestas} lámina(s) puestas` +
            `${sinPregunta ? `, ${sinPregunta} sin pregunta que las reciba` : ''}` +
            `${malas ? `, ${malas} con formato raro` : ''}.`);
      if (puestas) t.log('Míralas en el Banco y publica cuando te convenzan.');
      t.fin(0);
    })().catch((e) => { t.log('Error: ' + e.message); t.fin(1); });
  },

  // Enlazar las imágenes que haya en public/images con sus preguntas.
  //
  // El otro camino (importar-laminas) copia archivos de fuera. Éste no copia
  // nada: las imágenes ya están en su sitio, sólo hay que apuntarlas en la
  // pregunta que les corresponde según el nombre del archivo.
  async 'POST /api/vincular-imagenes'(req, res) {
    let t;
    try { t = tareaPropia('Enlazar las imágenes'); }
    catch (e) { return json(res, { error: e.message }, 409); }
    json(res, { ok: true });

    (async () => {
      const r = banco.vincularImagenes();

      if (!r.total) {
        t.log('No hay ninguna imagen en public/images.');
        t.log('Deja ahí los archivos con el nombre de su pregunta (cfsd-0007.png) y vuelve a darle.');
        return t.fin(0);
      }

      t.log(`${r.total} imagen(es) en public/images\n`);
      for (const p of r.puestas) t.log(`  ✓ ${p.id} · ${p.archivo}`);
      if (r.yaEstaban.length) t.log(`\n  ${r.yaEstaban.length} ya estaban enlazadas y no se han tocado.`);

      if (r.repetidas.length) {
        t.log('\nHay preguntas con más de una imagen; se ha cogido la primera:');
        for (const x of r.repetidas) t.log(`  · ${x.id} → ${x.archivos.join(', ')}`);
      }

      if (r.sinPregunta.length) {
        t.log('\nEstos archivos no tienen ninguna pregunta con ese identificador:');
        for (const f of r.sinPregunta) t.log(`  ✗ ${f}`);
        t.log('Comprueba el nombre. Da igual el guion bajo y las mayúsculas,');
        t.log('pero el número tiene que coincidir con el de la pregunta.');
      }

      t.log(`\nTerminado. ${r.puestas.length} enlazada(s) de nuevas.`);
      if (r.puestas.length) t.log('Míralas en el Banco y publica cuando te convenzan.');
      t.fin(0);
    })().catch((e) => { t.log('Error: ' + e.message); t.fin(1); });
  },

  // Desenlazar la ilustración de una pregunta, sin borrar el archivo.
  async 'POST /api/quitar-imagen'(req, res) {
    const { id } = await leerCuerpo(req);
    if (!id) return json(res, { error: 'Falta el identificador' }, 400);
    const ok = banco.desvincularImagen(id);
    if (!ok) return json(res, { error: 'No existe esa pregunta' }, 404);
    json(res, { ok: true });
  },

  // Esquemas: un dibujo sencillo para acompañar la explicación.
  async 'POST /api/esquemas'(req, res) {
    const cuerpo = await leerCuerpo(req);
    const ajustes = banco.guardarAjustes({ modelo: cuerpo.modelo || 'gemma3:4b' });
    let t;
    try { t = tareaPropia('Generar esquemas'); }
    catch (e) { return json(res, { error: e.message }, 409); }
    json(res, { ok: true });

    (async () => {
      const todas = cuerpo.modulo ? banco.leerModulo(cuerpo.modulo) : banco.leerTodo();
      // Sin explicación no hay nada de donde sacar el esquema. Y si ya tiene
      // uno, no se rehace salvo que se pida a propósito.
      const pendientes = todas.filter((p) =>
        p.explicacion && (cuerpo.rehacer || !p.imagen));

      if (!pendientes.length) { t.log('No hay ninguna pregunta que encaje.'); return t.fin(0); }
      t.log(`${pendientes.length} pregunta(s) con ${ajustes.modelo}.`);
      t.log('El modelo no dibuja: sólo elige qué lámina del cuaderno le viene bien.\n');

      let hechos = 0, sinEsquema = 0, fallos = 0;
      for (let i = 0; i < pendientes.length; i++) {
        if (tarea.cancelada) { t.log('Detenido.'); break; }
        const p = pendientes[i];
        const t0 = Date.now();
        const cuenta = `  ${i + 1}/${pendientes.length} · ${p.id}`;
        try {
          const { datos, svg } = await generarEsquema(p, {
            url: ajustes.urlOllama, modelo: ajustes.modelo,
          });
          const segundos = ((Date.now() - t0) / 1000).toFixed(0);
          if (!svg) {
            sinEsquema++;
            t.log(`${cuenta} · sin esquema${datos ? ' (el modelo dice que no procede)' : ''} · ${segundos}s`);
            continue;
          }
          const ruta = banco.guardarEsquema(p.id, svg);
          banco.guardarPregunta({ ...p, imagen: ruta });
          hechos++;
          t.log(`${cuenta} · ${datos.lamina} · ${segundos}s`);
        } catch (e) {
          fallos++;
          t.log(`${cuenta} · ERROR: ${e.message}`);
          if (/fetch failed|ECONNREFUSED/i.test(e.message)) {
            t.log('  Se ha perdido la conexión con Ollama. ¿Está abierto?');
            break;
          }
        }
      }

      t.log(`\nTerminado. ${hechos} con esquema` +
            `${sinEsquema ? `, ${sinEsquema} sin esquema` : ''}` +
            `${fallos ? `, ${fallos} con error` : ''}.`);
      if (hechos) t.log('Míralos en el Banco antes de publicar: un esquema que despiste es peor que ninguno.');
      t.fin(0);
    })().catch((e) => { t.log('Error: ' + e.message); t.fin(1); });
  },

  // --- Publicar ------------------------------------------------------------

  // Dónde ha quedado publicada la app y si GitHub la está sirviendo.
  //
  // Va aparte de /api/estado porque consulta a GitHub por la red y ese estado
  // se pide muy a menudo; aquí sólo se mira al abrir la pestaña Publicar.
  async 'GET /api/pages'(req, res) {
    const remoto = await ejecutar('git', ['remote', 'get-url', 'origin']);
    if (!remoto.ok) return json(res, { hay: false });

    // De la dirección del repositorio sale la de la app, sin preguntar a nadie.
    const m = remoto.salida.trim()
      .match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
    const prevista = m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : null;

    const datos = { hay: true, repo: remoto.salida.trim(), prevista };

    const info = await ejecutar('gh', ['repo', 'view', '--json', 'visibility,url']);
    if (info.ok) {
      try {
        const j = JSON.parse(info.salida);
        datos.visibilidad = String(j.visibility || '').toLowerCase();  // public | private
        datos.repoWeb = j.url;
      } catch { /* si gh cambia el formato, se sigue sin este dato */ }
    }

    const pages = await ejecutar('gh', ['api', 'repos/{owner}/{repo}/pages']);
    if (pages.ok) {
      try {
        const j = JSON.parse(pages.salida);
        datos.pages = { activo: true, url: j.html_url, estado: j.status || null };
      } catch { /* idem */ }
    } else {
      datos.pages = { activo: false };
    }

    // La última tanda de construcción, para saber si va, si ya está o si falló.
    const run = await ejecutar('gh', ['run', 'list', '--limit', '1',
      '--json', 'status,conclusion,url,createdAt']);
    if (run.ok) {
      try {
        const [r] = JSON.parse(run.salida);
        if (r) datos.construccion = { estado: r.status, resultado: r.conclusion, url: r.url };
      } catch { /* idem */ }
    }

    json(res, datos);
  },

  // Activar Pages y lanzar la construcción, sin ir a buscarlo por la web.
  async 'POST /api/pages-activar'(req, res) {
    const guion = [
      'set -e',
      'echo "Comprobando el repositorio…"',
      'VISIBILIDAD=$(gh repo view --json visibility -q .visibility)',
      'echo "Visibilidad: $VISIBILIDAD"',
      'if [ "$VISIBILIDAD" != "PUBLIC" ]; then',
      '  echo "" >&2',
      '  echo "El repositorio es privado y GitHub Pages gratuito solo publica los" >&2',
      '  echo "publicos. Usa el boton \\"Hacerlo publico\\" del panel y vuelve aqui." >&2',
      '  exit 1',
      'fi',
      'echo "Activando GitHub Pages…"',
      'gh api -X POST "repos/{owner}/{repo}/pages" -f "build_type=workflow" >/dev/null 2>&1 \\',
      '  || gh api -X PUT "repos/{owner}/{repo}/pages" -f "build_type=workflow" >/dev/null 2>&1 \\',
      '  || echo "(ya estaba activado)"',
      'echo "Lanzando la construcción…"',
      'gh workflow run deploy.yml >/dev/null 2>&1 || echo "(se construirá con la próxima publicación)"',
      'echo ""',
      'echo "Listo. GitHub tarda un par de minutos."',
      'gh repo view --json owner,name -q "\\"Tu app estará en https://\\" + (.owner.login | ascii_downcase) + \\".github.io/\\" + .name + \\"/\\""',
    ].join('\n');
    try {
      lanzar('Activar GitHub Pages', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 409); }
  },

  // Cambiar el repositorio a público. Es una decisión del usuario, así que la
  // interfaz pide confirmación antes de llamar aquí.
  async 'POST /api/repo-publico'(req, res) {
    const guion = [
      'set -e',
      'gh repo edit --visibility public --accept-visibility-change-consequences',
      'echo "El repositorio ya es público."',
      'echo "Ahora dale a «Activar Pages y construir»."',
    ].join('\n');
    try {
      lanzar('Hacer público el repositorio', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 409); }
  },

  // --- Primera publicación -------------------------------------------------
  //
  // Todo esto se hace UNA vez. Se parte en tres pasos para que cada uno tenga
  // un mensaje claro si falla, en vez de un guion largo que se rompe por en
  // medio y deja el repositorio a medias.

  // Paso 1: convertir la carpeta en un repositorio y guardar el primer commit.
  async 'POST /api/git-init'(req, res) {
    const { nombre = '', correo = '' } = await leerCuerpo(req);
    const yaEs = await ejecutar('git', ['rev-parse', '--git-dir']);

    const guion = [
      'set -e',
      yaEs.ok ? 'echo "La carpeta ya era un repositorio."'
              : 'git init -b main\necho "Carpeta preparada como repositorio."',
      nombre ? `git config user.name ${JSON.stringify(nombre)}` : '',
      correo ? `git config user.email ${JSON.stringify(correo)}` : '',
      // Sin identidad git se niega a hacer el commit, y su mensaje de error no
      // hay quien lo entienda. Mejor decirlo en claro y parar aquí.
      'if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then',
      '  echo "Falta decir quién eres: escribe tu nombre y tu correo arriba." >&2',
      '  exit 1',
      'fi',
      'git add -A',
      'if git diff --cached --quiet; then echo "No hay nada nuevo que guardar."; else',
      '  git commit -m "Primera versión: app de test y panel"',
      '  echo "Guardado el primer commit."',
      'fi',
      'echo ""',
      'echo "AHORA: vuelve al panel y conecta con GitHub."',
    ].filter(Boolean).join('\n');

    try {
      lanzar('Preparar el repositorio', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 409); }
  },

  // Paso 2a: crear el repositorio en GitHub con su herramienta oficial.
  async 'POST /api/git-crear'(req, res) {
    const { nombre = '', privado = true } = await leerCuerpo(req);
    if (!/^[\w.-]+$/.test(nombre)) {
      return json(res, { error: 'El nombre sólo puede llevar letras, números, guiones y puntos' }, 400);
    }
    const guion = [
      'set -e',
      `gh repo create ${JSON.stringify(nombre)} --source=. --push --${privado ? 'private' : 'public'}`,
      'echo "Repositorio creado y subido."',
      '# Pages se sirve desde la propia GitHub Action, no desde una rama.',
      'gh api -X POST "repos/{owner}/{repo}/pages" -f "build_type=workflow" >/dev/null 2>&1 \\',
      '  || gh api -X PUT "repos/{owner}/{repo}/pages" -f "build_type=workflow" >/dev/null 2>&1 \\',
      '  || echo "No se ha podido activar Pages solo: actívalo en Settings › Pages › Source: GitHub Actions."',
      'echo ""',
      'echo "La dirección de tu app sera:"',
      'gh repo view --json owner,name -q "\\"https://\\" + .owner.login + \\".github.io/\\" + .name + \\"/\\""',
      'echo ""',
      'echo "GitHub tarda un par de minutos en construirla la primera vez."',
    ].join('\n');

    try {
      lanzar('Crear el repositorio en GitHub', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 409); }
  },

  // Paso 2b: conectar con un repositorio que ya has creado tú en la web.
  async 'POST /api/git-conectar'(req, res) {
    const { url = '' } = await leerCuerpo(req);
    if (!/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(\.git)?\/?$/.test(url.trim())) {
      return json(res, { error: 'Esa no parece la dirección de un repositorio de GitHub' }, 400);
    }
    const guion = [
      'set -e',
      `git remote remove origin 2>/dev/null || true`,
      `git remote add origin ${JSON.stringify(url.trim())}`,
      'git branch -M main',
      // Sin esto, si git pide usuario y contraseña se queda esperando para
      // siempre y el panel parece colgado. Así falla rápido y se explica.
      'export GIT_TERMINAL_PROMPT=0',
      'if ! git push -u origin main; then',
      '  echo "" >&2',
      '  echo "GitHub no ha aceptado la subida. Casi siempre es que este Mac todavia no" >&2',
      '  echo "tiene permiso. La forma comoda de arreglarlo, una sola vez en el Terminal:" >&2',
      '  echo "    brew install gh && gh auth login" >&2',
      '  echo "y despues vuelve a darle al boton." >&2',
      '  exit 1',
      'fi',
      'echo ""',
      'echo "Subido. Ahora, en la pagina del repositorio en GitHub:"',
      'echo "   Settings › Pages › Source: GitHub Actions"',
      'echo "y en un par de minutos la app estara publicada."',
    ].join('\n');

    try {
      lanzar('Conectar con GitHub', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) { json(res, { error: e.message }, 409); }
  },

  async 'POST /api/publicar'(req, res) {
    const { mensaje = 'Actualizar preguntas' } = await leerCuerpo(req);
    // Se sube TODO lo que haya cambiado, no sólo las preguntas: si el programa
    // se ha actualizado y no se sube, los arreglos nunca llegan a la app del
    // móvil, y el panel decía "13 archivos" y luego "nada que publicar".
    const guion =
      'set -e\n' +
      'git add -A\n' +
      'if git diff --cached --quiet; then echo "No hay cambios que publicar."; exit 0; fi\n' +
      'echo "Se van a subir:"\n' +
      'git diff --cached --name-only | sed "s/^/   /"\n' +
      'echo ""\n' +
      `git commit -m ${JSON.stringify(mensaje)}\n` +
      'export GIT_TERMINAL_PROMPT=0\n' +
      'git push\n' +
      'echo ""\n' +
      'echo "Publicado. GitHub tarda un par de minutos en actualizar la app."\n';
    try {
      lanzar('Publicar en GitHub', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) {
      json(res, { error: e.message }, 409);
    }
  },

  // --- Ver la app en local -------------------------------------------------

  async 'POST /api/dev'(req, res) {
    const { accion } = await leerCuerpo(req);
    if (accion === 'parar') {
      procesoDev?.kill('SIGTERM');
      procesoDev = null;
      urlDev = null;
      return json(res, { activo: false });
    }
    if (procesoDev) return json(res, { activo: true, url: urlDev });

    procesoDev = spawn('npm', ['run', 'dev'], { cwd: RAIZ });
    procesoDev.stdout.on('data', (d) => {
      const m = d.toString().match(/https?:\/\/localhost:\d+\/?\S*/);
      if (m && !urlDev) urlDev = m[0];
    });
    procesoDev.on('close', () => { procesoDev = null; urlDev = null; });

    // Damos un margen a Vite para que anuncie su dirección.
    await new Promise((r) => setTimeout(r, 2500));
    json(res, { activo: true, url: urlDev || 'http://localhost:5173/' });
  },

  // --- Actualizar el proyecto desde la carpeta de Cowork -------------------
  //
  // Evita tener que copiar archivos a mano desde el Terminal. Busca la copia
  // más reciente que haya dejado Cowork y la trae, respetando public/data
  // (tus preguntas) y node_modules.

  async 'GET /api/actualizacion'(req, res) {
    const origen = buscarOrigen();
    if (!origen) return json(res, { hay: false, motivo: 'no encontrada' });
    const cambios = compararCodigo(origen.ruta, RAIZ);
    json(res, {
      hay: cambios.length > 0,
      origen: origen.ruta,
      cambios: cambios.slice(0, 12),
      totalCambios: cambios.length,
    });
  },

  async 'POST /api/actualizar'(req, res) {
    const origen = buscarOrigen();
    if (!origen) {
      return json(res, { error: 'No se ha encontrado ninguna copia de Cowork en tu carpeta de inicio.' }, 404);
    }
    const guion =
      'set -e\n' +
      `rsync -a --exclude 'public/data' --exclude node_modules --exclude .git --exclude .panel.json --exclude .bin ${JSON.stringify(origen.ruta + '/')} ${JSON.stringify(RAIZ + '/')}\n` +
      `chmod -R u+w ${JSON.stringify(RAIZ)}\n` +
      `chmod +x ${JSON.stringify(path.join(RAIZ, 'Panel.command'))} || true\n` +
      'echo ""\n' +
      'echo "Actualizado. Tus preguntas no se han tocado."\n' +
      'echo "AHORA: cierra la ventana de Terminal del panel y vuelve a abrir Panel.command."\n';
    try {
      lanzar('Actualizar el programa', '/bin/bash', ['-c', guion]);
      json(res, { ok: true });
    } catch (e) {
      json(res, { error: e.message }, 409);
    }
  },

  async 'POST /api/ajustes'(req, res) {
    json(res, { ajustes: banco.guardarAjustes(await leerCuerpo(req)) });
  },

  async 'POST /api/abrir'(req, res) {
    const { url } = await leerCuerpo(req);
    if (url) execFile('open', [url]);
    json(res, { ok: true });
  },
};

// --- Arranque ---------------------------------------------------------------

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  const clave = `${req.method} ${url.pathname}`;

  if (rutas[clave]) {
    try {
      return await rutas[clave](req, res, url);
    } catch (e) {
      if (!res.headersSent) return json(res, { error: e.message }, 500);
      return res.end();
    }
  }

  const TIPOS = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
    '.gif': 'image/gif', '.json': 'application/json',
  };
  const binario = (ext) => !['.html', '.js', '.css', '.svg', '.json'].includes(ext);

  // Archivos de public/, para poder enseñar en el panel las ilustraciones tal
  // y como se verán en la app. Sólo lectura y sólo de dentro de public.
  if (url.pathname.startsWith('/archivo/')) {
    const pedido = decodeURIComponent(url.pathname.slice('/archivo/'.length));
    const dentro = path.join(RAIZ, 'public');
    const completo = path.resolve(dentro, pedido);
    if (completo.startsWith(dentro + path.sep) && fs.existsSync(completo) && fs.statSync(completo).isFile()) {
      const ext = path.extname(completo).toLowerCase();
      res.writeHead(200, {
        'content-type': (TIPOS[ext] || 'application/octet-stream') + (binario(ext) ? '' : '; charset=utf-8'),
        'cache-control': 'no-cache',
      });
      return res.end(fs.readFileSync(completo));
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('No encontrado');
  }

  // Archivos estáticos del panel.
  const archivo = url.pathname === '/' ? 'ui.html' : url.pathname.replace(/^\/+/, '');
  const completo = path.join(AQUI, archivo);
  if (completo.startsWith(AQUI) && fs.existsSync(completo) && fs.statSync(completo).isFile()) {
    const ext = path.extname(completo).toLowerCase();
    res.writeHead(200, {
      'content-type': (TIPOS[ext] || 'text/plain') + (binario(ext) ? '' : '; charset=utf-8'),
    });
    return res.end(fs.readFileSync(completo));
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  const direccion = `http://localhost:${PUERTO}`;
  console.log('');
  console.log('  Panel de Test de Mecánica');
  console.log('  ' + direccion);
  console.log('');
  console.log('  Deja esta ventana abierta mientras uses el panel.');
  console.log('  Para cerrarlo: Control + C, o cierra la ventana.');
  console.log('');
  if (!process.env.SIN_ABRIR) execFile('open', [direccion], () => {});
});

servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  El puerto ${PUERTO} está ocupado: puede que el panel ya esté abierto.`);
    console.error(`  Prueba a entrar en http://localhost:${PUERTO}\n`);
  } else {
    console.error('\n  No se ha podido arrancar el panel: ' + e.message + '\n');
  }
  process.exit(1);
});

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    procesoDev?.kill('SIGTERM');
    tarea?.proceso?.kill('SIGTERM');
    process.exit(0);
  });
}
