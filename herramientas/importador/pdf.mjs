// ---------------------------------------------------------------------------
// Extracción de texto del PDF del tema y búsqueda de los pasajes relevantes
// para cada pregunta.
//
// La idea: en vez de pedirle al modelo que recuerde mecánica de automoción
// (que es donde un modelo pequeño se inventa cosas), le damos el trozo del
// temario que habla de eso y le pedimos que explique con ese material delante.
// ---------------------------------------------------------------------------

import fs from 'node:fs';

/** Extrae el texto de un PDF, página a página. Devuelve [{ pagina, texto }]. */
export async function textoPdf(ruta) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const datos = new Uint8Array(fs.readFileSync(ruta));
  // Ojo: quien tiene destroy() es la tarea de carga, no el documento.
  const tarea = pdfjs.getDocument({ data: datos, useSystemFonts: true });
  const doc = await tarea.promise;

  const paginas = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pag = await doc.getPage(n);
      const contenido = await pag.getTextContent();
      const texto = contenido.items
        .map((i) => (typeof i.str === 'string' ? i.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (texto) paginas.push({ pagina: n, texto });
    }
  } finally {
    await tarea.destroy();
  }
  return paginas;
}

/**
 * Trocea las páginas en fragmentos manejables, guardando de qué página viene
 * cada uno para poder rellenar material.pagina más adelante.
 */
export function trocear(paginas, { tamaño = 900, solape = 150 } = {}) {
  const trozos = [];
  for (const { pagina, texto } of paginas) {
    if (texto.length <= tamaño) {
      trozos.push({ pagina, texto });
      continue;
    }
    for (let i = 0; i < texto.length; i += tamaño - solape) {
      const parte = texto.slice(i, i + tamaño).trim();
      if (parte.length > 80) trozos.push({ pagina, texto: parte });
    }
  }
  return trozos;
}

const VACIAS = new Set([
  'para','como','cuando','donde','desde','entre','sobre','hasta','porque','pero','este','esta',
  'estos','estas','todos','todas','otro','otra','cual','cuales','que','los','las','del','con',
  'una','uno','por','sus','son','ser','mas','muy','sin','ese','esa','sea','han','hay','fue',
  'anteriores','correctas','correcta','respuestas','respuesta','siguientes','siguiente','ninguna',
]);

function palabrasClave(texto) {
  return [...new Set(
    String(texto)
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 4 && !VACIAS.has(p))
  )];
}

/**
 * Devuelve los `cuantos` trozos que más se parecen a la consulta.
 * Es coincidencia de términos, sin embeddings: para un temario de un tema
 * concreto funciona bien y no necesita ni modelo ni base de datos.
 */
export function buscarRelevantes(trozos, consulta, { cuantos = 2 } = {}) {
  const claves = palabrasClave(consulta);
  if (!claves.length || !trozos.length) return [];

  const puntuados = trozos.map((t) => {
    const texto = t.texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    let puntos = 0;
    for (const c of claves) {
      let desde = 0, veces = 0;
      while (veces < 4) {
        const i = texto.indexOf(c, desde);
        if (i === -1) break;
        veces++;
        desde = i + c.length;
      }
      // Raíz cuadrada: que una palabra salga 4 veces no vale 4 veces más.
      if (veces) puntos += Math.sqrt(veces);
    }
    return { ...t, puntos: puntos / Math.sqrt(t.texto.length / 500) };
  });

  return puntuados
    .filter((t) => t.puntos > 0.9)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, cuantos);
}
