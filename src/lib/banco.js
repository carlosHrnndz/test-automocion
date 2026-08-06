// ---------------------------------------------------------------------------
// Carga y filtrado del banco de preguntas.
// Los datos viven en public/data/ y se sirven como archivos estáticos.
// ---------------------------------------------------------------------------

import { ESTRUCTURA } from './estructura.js';

const BASE = import.meta.env.BASE_URL || '/';

/**
 * Completa una ruta de dentro de public/ con la base donde esté publicada la
 * app. En GitHub Pages la app cuelga de /nombre-del-repo/, así que una ruta
 * como "data/esquemas/x.svg" tiene que llevar ese prefijo delante.
 */
export function rutaDeArchivo(ruta) {
  if (!ruta) return null;
  if (/^(https?:|data:|\/)/.test(ruta)) return ruta;   // ya es absoluta
  return BASE + ruta;
}

let cache = null;
let cargando = null;

async function json(ruta) {
  const r = await fetch(BASE + ruta, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
  return r.json();
}

/**
 * Carga el manifiesto y todos los archivos de preguntas que declare.
 * Devuelve { preguntas, porModulo, manifiesto }.
 */
export async function cargarBanco() {
  if (cache) return cache;
  if (cargando) return cargando;

  cargando = (async () => {
    let manifiesto;
    try {
      manifiesto = await json('data/manifest.json');
    } catch {
      manifiesto = { modulos: [] };
    }

    const listas = await Promise.all(
      (manifiesto.modulos || []).map(async (m) => {
        try {
          const datos = await json('data/' + m.archivo);
          return Array.isArray(datos) ? datos : datos.preguntas || [];
        } catch (e) {
          console.warn('Módulo omitido:', m.archivo, e.message);
          return [];
        }
      })
    );

    const preguntas = listas.flat().filter((p) => p && p.pregunta && Array.isArray(p.opciones));

    const porModulo = {};
    for (const p of preguntas) {
      (porModulo[p.moduloId] ||= []).push(p);
    }

    cache = { preguntas, porModulo, manifiesto };
    return cache;
  })();

  return cargando;
}

export function invalidarCache() {
  cache = null;
  cargando = null;
}

/** Módulos que realmente tienen preguntas, en el orden del temario. */
export function modulosConPreguntas(banco) {
  return ESTRUCTURA.map((m) => {
    const preguntas = banco.porModulo[m.id] || [];
    const submodulos = [];
    const vistos = new Map();
    for (const p of preguntas) {
      const clave = p.submoduloId || 'sin-clasificar';
      if (!vistos.has(clave)) {
        vistos.set(clave, { id: clave, nombre: p.submodulo || 'Sin clasificar', total: 0 });
        submodulos.push(vistos.get(clave));
      }
      vistos.get(clave).total += 1;
    }
    // Ordena los submódulos según el temario; los desconocidos van al final.
    const orden = new Map(m.submodulos.map((s, i) => [s, i]));
    submodulos.sort((a, b) => (orden.get(a.nombre) ?? 999) - (orden.get(b.nombre) ?? 999));
    return { ...m, total: preguntas.length, submodulos };
  }).filter((m) => m.total > 0);
}

/** Filtra por módulo y, opcionalmente, submódulo. */
export function filtrar(banco, { moduloId, submoduloId } = {}) {
  let lista = moduloId ? banco.porModulo[moduloId] || [] : banco.preguntas;
  if (submoduloId && submoduloId !== 'todos') {
    lista = lista.filter((p) => (p.submoduloId || 'sin-clasificar') === submoduloId);
  }
  return lista;
}

/** Fisher-Yates. Devuelve una copia. */
export function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Construye un test: baraja, recorta a la cantidad pedida y —si se pide—
 * baraja también las opciones de cada pregunta manteniendo cuál es la correcta.
 */
export function construirTest(preguntas, { cantidad = 'todas', aleatorio = true, barajarOpciones = true } = {}) {
  let lista = aleatorio ? barajar(preguntas) : [...preguntas];
  if (cantidad !== 'todas') lista = lista.slice(0, Number(cantidad));

  if (!barajarOpciones) return lista;

  return lista.map((p) => {
    const indices = barajar(p.opciones.map((_, i) => i));
    return {
      ...p,
      opciones: indices.map((i) => p.opciones[i]),
      correcta: indices.indexOf(p.correcta),
    };
  });
}

/** Etiqueta de letra para una opción: 0 -> A, 1 -> B... */
export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
