// ---------------------------------------------------------------------------
// De líneas OCR + bandas verdes a una pregunta estructurada.
// ---------------------------------------------------------------------------

import { solape, recorteRealzado } from './imagen.mjs';
import { ocrDeBuffer } from './ocr.mjs';

const RE_CABECERA  = /pregunta\s*[:.]?/i;
const RE_ID        = /(\d{5,})/;
const RE_RESPUESTAS= /^\s*respuestas?\s*[:.]?\s*$/i;
// Basura típica: el contador "1 / 40", el cursor del ratón, restos de bordes.
const RE_CONTADOR  = /^\s*\d{1,3}\s*[/|]\s*\d{1,3}\s*$/;
// El círculo del radio button que el OCR interpreta como letra suelta.
const RE_RADIO     = /^\s*[O0o©@®•*·.,~^]\s+/;

function limpiar(t) {
  return String(t)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function esRuido(texto) {
  const t = texto.trim();
  if (!t) return true;
  if (RE_CONTADOR.test(t)) return true;
  // Menos de 3 caracteres útiles: cursores, bordes, artefactos.
  if (t.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return true;
  return false;
}

/**
 * Agrupa las líneas de opciones en bloques. Una opción puede ocupar varias
 * líneas: se detecta porque el hueco vertical entre líneas de la misma opción
 * es mucho menor que el hueco entre opciones distintas.
 */
const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
};

/**
 * Elige a partir de qué hueco se considera que empieza otra opción.
 *
 * Comparar el hueco con la altura de la línea no vale: cada lector devuelve
 * cajas de distinto grosor (las de Vision son más altas que las de Tesseract),
 * y con un umbral fijo o se fusionan todas las opciones en una o se parte cada
 * opción en trozos.
 *
 * Lo que sí sabemos seguro es que los tests de la academia tienen 3 o 4
 * opciones. Así que se prueban todos los cortes posibles entre los huecos que
 * hay de verdad en la imagen y se elige el que deja un número plausible de
 * opciones. Cuando varios empatan, gana el corte más "limpio": aquel donde la
 * diferencia entre el hueco de dentro de una opción y el de entre opciones es
 * mayor, que es el que separa con menos duda.
 */
// A partir de aquí se considera que dos huecos son de distinta naturaleza:
// uno de dentro de una opción y otro de separación entre opciones.
const SALTO_CLARO = 2.5;

function elegirUmbral(huecos) {
  const distintos = [...new Set(huecos.filter((h) => h > 0))].sort((a, b) => a - b);
  // Por defecto no se fusiona nada: cada línea es una opción. Juntar dos
  // opciones distintas en una hace más daño que partir una en dos, porque la
  // de más salta a la vista en el Banco y la de menos desaparece sin más.
  if (distintos.length < 2) return 0;

  // Se buscan saltos grandes entre huecos consecutivos. Un salto grande
  // significa que ahí hay dos grupos de verdad; si todos los huecos son
  // parecidos, es una lista de opciones de una línea y no hay nada que unir.
  const saltos = [];
  for (let i = 1; i < distintos.length; i++) {
    const razon = distintos[i] / distintos[i - 1];
    if (razon >= SALTO_CLARO) {
      saltos.push({ umbral: (distintos[i] + distintos[i - 1]) / 2, razon });
    }
  }
  if (!saltos.length) return 0;

  // Si hay varios saltos, gana el más marcado. Y a igualdad de evidencia, el
  // que deja un número de opciones de los que usa la academia (3 o 4).
  const plausible = (umbral) => {
    const trozos = huecos.filter((h) => h > umbral).length + 1;
    return trozos === 4 ? 2 : trozos === 3 ? 1 : 0;
  };
  saltos.sort((a, b) => b.razon - a.razon || plausible(b.umbral) - plausible(a.umbral));
  return saltos[0].umbral;
}

function agruparEnOpciones(lineas) {
  if (!lineas.length) return [];

  const huecos = [];
  for (let i = 1; i < lineas.length; i++) huecos.push(lineas[i].arriba - lineas[i - 1].abajo);
  const umbral = elegirUmbral(huecos);

  const bloques = [[lineas[0]]];
  for (let i = 1; i < lineas.length; i++) {
    if (huecos[i - 1] > umbral) bloques.push([lineas[i]]);
    else bloques[bloques.length - 1].push(lineas[i]);
  }

  return bloques.map((bloque) => ({
    texto: limpiar(bloque.map((l) => l.texto).join(' ')).replace(RE_RADIO, ''),
    arriba: Math.min(...bloque.map((l) => l.arriba)),
    abajo: Math.max(...bloque.map((l) => l.abajo)),
    izquierda: Math.min(...bloque.map((l) => l.izquierda ?? 0)),
    conf: Math.round(bloque.reduce((a, l) => a + l.conf, 0) / bloque.length),
    rescatado: bloque.some((l) => l.rescatada),
  }));
}

/**
 * Descarta los bloques que no son opciones de verdad.
 *
 * La señal más fiable es la alineación: en la pantalla de la academia todas
 * las opciones arrancan a la misma distancia del margen izquierdo. Cualquier
 * cosa que aparezca desplazada —el cursor del ratón, un pie de página, el
 * borde de la ventana— no es una opción, por mucho que el OCR la lea.
 */
function descartarIntrusos(bloques, avisos) {
  if (bloques.length < 3) return bloques;

  const izquierdas = bloques.map((b) => b.izquierda).filter((n) => Number.isFinite(n));
  if (izquierdas.length < 3) return bloques;
  const margen = mediana(izquierdas);
  // Tolerancia generosa: una sangría pequeña sigue siendo la misma columna.
  const tolerancia = Math.max(40, margen * 0.25);

  const buenos = [];
  for (const b of bloques) {
    const desviado = Number.isFinite(b.izquierda) && Math.abs(b.izquierda - margen) > tolerancia;
    const confianzaMala = b.conf > 0 && b.conf < 45;
    if (desviado || confianzaMala) {
      avisos.push(`Se ha descartado "${b.texto.slice(0, 40)}…" ` +
        (desviado ? 'porque no está alineada con las demás opciones.' : 'por lectura poco fiable.'));
      continue;
    }
    buenos.push(b);
  }
  // Si el filtro se ha llevado casi todo, algo hemos entendido mal: mejor no tocar.
  return buenos.length >= 2 ? buenos : bloques;
}

/**
 * Rescata las opciones que están escritas en blanco sobre el fondo verde.
 *
 * Tesseract lee mal el texto claro sobre color medio, así que en la pasada
 * normal la opción marcada como correcta se pierde entera. Aquí se recorta
 * cada banda verde, se le da la vuelta al contraste y se vuelve a leer.
 *
 * Devuelve las líneas nuevas encontradas, con las coordenadas de la banda
 * para que encajen en su sitio al reordenar.
 */
export function rescatarZonasVerdes(img, bandas, lineas, opciones = {}) {
  if (!img || !bandas?.length) return [];

  const alturaTipica = (() => {
    const hs = lineas.map((l) => l.abajo - l.arriba).sort((a, b) => a - b);
    return hs[Math.floor(hs.length / 2)] || 24;
  })();

  const nuevas = [];
  for (const banda of bandas) {
    // Si ya hay texto leído dentro de la banda, no hace falta rescatarla.
    const yaHayTexto = lineas.some((l) =>
      solape(l.arriba, l.abajo, banda.arriba, banda.abajo) > (l.abajo - l.arriba) * 0.4);
    if (yaHayTexto) continue;

    let recorte;
    try { recorte = recorteRealzado(img, banda); } catch { recorte = null; }
    if (!recorte) continue;

    const texto = ocrDeBuffer(recorte, opciones);
    if (!texto) continue;

    nuevas.push({
      texto,
      arriba: banda.arriba,
      abajo: banda.abajo,
      izquierda: banda.izquierda ?? 0,
      derecha: banda.derecha ?? 0,
      conf: 80,
      rescatada: true,
    });
  }

  // Bandas contiguas (una opción de dos líneas) se unen en una sola.
  nuevas.sort((a, b) => a.arriba - b.arriba);
  const unidas = [];
  for (const n of nuevas) {
    const previa = unidas[unidas.length - 1];
    if (previa && n.arriba - previa.abajo < alturaTipica * 0.75) {
      previa.texto += ' ' + n.texto;
      previa.abajo = n.abajo;
    } else {
      unidas.push({ ...n });
    }
  }
  return unidas;
}

/**
 * Convierte el resultado del OCR en una pregunta.
 * Devuelve { pregunta, opciones, correcta, idExterno, conf, avisos }.
 * `correcta` es null si no se ha podido determinar: nunca se adivina.
 */
export function extraerPregunta(lineas, bandas) {
  const avisos = [];
  const utiles = lineas.filter((l) => !esRuido(l.texto));

  if (!utiles.length) return { avisos: ['La imagen no contiene texto legible.'], opciones: [] };

  // --- Cabecera y enunciado ---
  let iCabecera = utiles.findIndex((l) => RE_CABECERA.test(l.texto));
  let idExterno = null;
  if (iCabecera >= 0) {
    const m = utiles[iCabecera].texto.match(RE_ID);
    if (m) idExterno = m[1];
  } else {
    avisos.push('No se ha encontrado la cabecera "PREGUNTA:".');
    iCabecera = -1;
  }

  const iRespuestas = utiles.findIndex((l, i) => i > iCabecera && RE_RESPUESTAS.test(l.texto));

  let lineasEnunciado, lineasOpciones;
  if (iRespuestas > 0) {
    lineasEnunciado = utiles.slice(iCabecera + 1, iRespuestas);
    lineasOpciones = utiles.slice(iRespuestas + 1);
  } else {
    // Sin la línea "RESPUESTAS" no sabemos dónde corta: asumimos que el
    // enunciado es lo primero y avisamos para que se revise a mano.
    avisos.push('No se ha encontrado la línea "RESPUESTAS"; revisa dónde acaba el enunciado.');
    lineasEnunciado = utiles.slice(iCabecera + 1, iCabecera + 2);
    lineasOpciones = utiles.slice(iCabecera + 2);
  }

  // Si la cabecera lleva texto detrás del paréntesis, forma parte del enunciado.
  let pregunta = '';
  if (iCabecera >= 0) {
    const resto = utiles[iCabecera].texto.replace(RE_CABECERA, '').replace(/^\s*\([^)]*\)\s*/, '').trim();
    if (resto.length > 8) pregunta = resto + ' ';
  }
  pregunta = limpiar(pregunta + lineasEnunciado.map((l) => l.texto).join(' '));

  // --- Opciones ---
  const opciones = descartarIntrusos(
    agruparEnOpciones(lineasOpciones).filter((o) => o.texto.length >= 3),
    avisos
  );

  if (!pregunta) avisos.push('Enunciado vacío.');
  if (opciones.length < 2) avisos.push(`Sólo se han detectado ${opciones.length} opción(es).`);
  // Los tests de la academia son de 3 o 4 opciones. Más es casi siempre que
  // el OCR ha partido una en dos o ha colado ruido.
  if (opciones.length > 4) {
    avisos.push(`Se han detectado ${opciones.length} opciones, más de las 4 habituales: ` +
      'comprueba que ninguna esté partida en dos.');
  }
  const cortas = opciones.filter((o) => o.texto.length < 8);
  if (cortas.length && opciones.length > 2) {
    avisos.push(`Hay ${cortas.length} opción(es) sospechosamente corta(s): ` +
      cortas.map((o) => `"${o.texto}"`).join(', '));
  }

  // --- Cuál está en verde ---
  //
  // Se cruzan las bandas verdes con la posición vertical de cada opción. La
  // regla principal es la más fiable: si el centro de la banda cae dentro de
  // una opción, esa es. Las demás son redes de seguridad para cuando el OCR
  // deja las cajas algo desplazadas o la opción ocupa varias líneas.
  let correcta = null;
  if (!bandas.length) {
    avisos.push('No se ha encontrado ninguna marca verde en la imagen.');
  } else {
    const marcas = opciones.map((o, i) => {
      const altura = Math.max(1, o.abajo - o.arriba);
      let mejorSolape = 0;
      let centroDentro = false;
      let cubreLaBanda = 0;
      for (const b of bandas) {
        const s = solape(o.arriba, o.abajo, b.arriba, b.abajo);
        if (s > mejorSolape) mejorSolape = s;
        const centroBanda = (b.arriba + b.abajo) / 2;
        if (centroBanda >= o.arriba && centroBanda <= o.abajo) centroDentro = true;
        const alturaBanda = Math.max(1, b.abajo - b.arriba);
        cubreLaBanda = Math.max(cubreLaBanda, s / alturaBanda);
      }
      return { i, solape: mejorSolape, altura, centroDentro, cubreLaBanda };
    });

    // 1) El centro de la banda cae dentro de la opción. Es la señal más limpia.
    let candidatas = marcas.filter((m) => m.centroDentro);

    // 2) La banda cubre buena parte de la opción.
    if (!candidatas.length) candidatas = marcas.filter((m) => m.solape > m.altura * 0.5);

    // 3) La opción cubre buena parte de la banda. Pasa cuando el OCR parte la
    //    opción en trozos y cada uno es más bajo que el rectángulo verde.
    if (!candidatas.length) candidatas = marcas.filter((m) => m.cubreLaBanda > 0.5);

    // 4) Último recurso: hay solape y no es ambiguo porque sólo lo tiene una.
    if (!candidatas.length) {
      const conSolape = marcas.filter((m) => m.solape > 0);
      if (conSolape.length === 1) {
        candidatas = conSolape;
        avisos.push('El verde encajaba de forma justa con una opción; compruébalo.');
      }
    }

    if (candidatas.length === 1) {
      correcta = candidatas[0].i;
    } else if (candidatas.length > 1) {
      candidatas.sort((a, b) => b.solape - a.solape);
      correcta = candidatas[0].i;
      avisos.push(`Hay ${candidatas.length} opciones tocando el verde; se ha elegido la de mayor solape.`);
    } else {
      const alturas = `verde en y=${bandas.map((b) => `${b.arriba}-${b.abajo}`).join(', ')}` +
        ` · opciones en y=${opciones.map((o) => `${o.arriba}-${o.abajo}`).join(', ')}`;
      avisos.push(`La marca verde no coincide con ninguna opción (${alturas}).`);
    }

    if (bandas.length > 1) {
      avisos.push(`Se han detectado ${bandas.length} zonas verdes: ¿hay algo más en verde en la captura?`);
    }
  }

  const conf = opciones.length
    ? Math.round(opciones.reduce((a, o) => a + o.conf, 0) / opciones.length)
    : 0;
  if (conf && conf < 75) avisos.push(`Confianza del OCR baja (${conf} %): revisa el texto.`);

  return {
    idExterno,
    pregunta,
    opciones: opciones.map((o) => o.texto),
    correcta,
    conf,
    avisos,
  };
}

/**
 * ¿La lectura ha salido entera? Hace falta enunciado, al menos dos opciones y
 * saber cuál es la buena. Si falta algo, merece la pena pedir una segunda
 * opinión al modelo de visión antes de darla por perdida.
 */
export function completa(extraida) {
  return !!extraida
    && !!extraida.pregunta
    && Array.isArray(extraida.opciones)
    && extraida.opciones.length >= 2
    && extraida.correcta !== null
    && extraida.correcta !== undefined;
}
