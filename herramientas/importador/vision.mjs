// ---------------------------------------------------------------------------
// Extracción de preguntas con un modelo de visión de Ollama.
//
// Alternativa a Tesseract: en vez de reconocer caracteres, se le enseña la
// captura a un modelo multimodal y se le pide la transcripción en JSON.
//
// Ventaja: entiende la estructura de la página, así que no se lía con las
// opciones de dos líneas ni con el texto sobre fondo de color.
// Riesgo: puede INVENTAR texto que suena bien pero no está en la imagen, cosa
// que un OCR clásico no hace. Por eso el prompt insiste tanto en copiar literal
// y en marcar [ILEGIBLE], y por eso la respuesta correcta se comprueba después
// contra la detección del color verde, que no se equivoca nunca.
// ---------------------------------------------------------------------------

import fs from 'node:fs';

const INSTRUCCIONES = `Eres un transcriptor. Tu única tarea es copiar EXACTAMENTE lo que ves en la imagen.

La imagen es una pregunta de test de un curso de Automoción. Contiene una cabecera
tipo "PREGUNTA: (Identificador nº 2778097)", el enunciado, la palabra "RESPUESTAS" y
entre 2 y 4 opciones. UNA de las opciones tiene FONDO VERDE: esa es la correcta.

REGLAS QUE NO PUEDES SALTARTE:

1. Copia el texto LETRA POR LETRA. No corrijas faltas, no cambies palabras por
   sinónimos, no completes frases, no arregles la puntuación.
2. Respeta tildes, eñes y mayúsculas tal como aparecen.
3. NO INVENTES NADA. Si algo está borroso o no lo lees con seguridad, escribe
   [ILEGIBLE] ahí. Es MUCHO mejor un [ILEGIBLE] que una palabra inventada.
4. NO añadas opciones que no estén. Cuéntalas antes de escribir.
5. La correcta es LA QUE TIENE FONDO VERDE, no la que a ti te parezca correcta por
   tus conocimientos. Si ninguna está en verde, pon "correcta": null.
6. No incluyas el círculo del botón de selección ni el contador tipo "1 / 40".

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin bloques de código:

{"idExterno":"el numero del identificador o null","pregunta":"el enunciado","opciones":["...","..."],"correcta":0,"confianza":"alta","dudas":""}

"correcta" es la posición de la opción verde empezando en 0.
"confianza" es "alta", "media" o "baja" según lo claro que lo hayas leído.
"dudas" es una frase corta sobre lo que no te haya quedado claro, o "".`;

/** Saca el JSON de la respuesta aguantando la basura de alrededor. */
export function extraerJson(texto) {
  let t = String(texto)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  try {
    const v = JSON.parse(t);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* seguimos */ }

  // Primer objeto completo que aparezca, contando llaves y respetando textos.
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
        try { return JSON.parse(t.slice(inicio, i + 1)); } catch { inicio = -1; }
      }
    }
  }
  throw new Error('la respuesta no traía un JSON reconocible');
}

/**
 * Pasa una captura por el modelo de visión.
 * Devuelve { idExterno, pregunta, opciones, correcta, conf, avisos }, con la
 * misma forma que devuelve el camino del OCR para que sean intercambiables.
 */
export async function extraerConVision(rutaImagen, { url, modelo, señal } = {}) {
  const imagen = fs.readFileSync(rutaImagen).toString('base64');

  const r = await fetch(`${url.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: señal,
    body: JSON.stringify({
      model: modelo,
      stream: false,
      think: false,
      options: { temperature: 0, num_predict: 1200 },
      messages: [{ role: 'user', content: INSTRUCCIONES, images: [imagen] }],
    }),
  });

  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 200);
    if (/does not support|vision|image/i.test(detalle)) {
      throw new Error(`el modelo "${modelo}" no acepta imágenes. Prueba con gemma3:4b`);
    }
    throw new Error(`HTTP ${r.status} · ${detalle}`);
  }

  const datos = await r.json();
  const bruto = (datos.message?.content || '').trim();
  if (!bruto) throw new Error('el modelo no ha respondido nada');

  const j = extraerJson(bruto);
  const avisos = [];

  const opciones = Array.isArray(j.opciones)
    ? j.opciones.map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (opciones.length < 2) avisos.push(`El modelo sólo ha visto ${opciones.length} opción(es).`);
  if (opciones.length > 4) avisos.push(`El modelo ha visto ${opciones.length} opciones, más de las 4 habituales.`);

  let correcta = Number.isInteger(j.correcta) ? j.correcta : null;
  if (correcta !== null && (correcta < 0 || correcta >= opciones.length)) {
    avisos.push(`El modelo ha señalado la opción ${correcta}, que no existe.`);
    correcta = null;
  }

  const confianza = String(j.confianza || '').toLowerCase();
  if (confianza && confianza !== 'alta') {
    avisos.push(`El modelo dice confianza "${confianza}"${j.dudas ? `: ${j.dudas}` : ''}.`);
  }

  const textoTodo = [j.pregunta, ...opciones].join(' ');
  if (/\[ILEGIBLE\]/i.test(textoTodo)) {
    avisos.push('El modelo ha marcado partes como ilegibles.');
  }

  return {
    idExterno: j.idExterno ? String(j.idExterno).replace(/\D/g, '') || null : null,
    pregunta: String(j.pregunta || '').replace(/\s+/g, ' ').trim(),
    opciones,
    correcta,
    // Traducimos la autoevaluación a un número para que encaje con el OCR.
    conf: confianza === 'alta' ? 90 : confianza === 'media' ? 70 : confianza === 'baja' ? 50 : 80,
    avisos,
  };
}

/**
 * Junta lo mejor de los dos caminos: el TEXTO que ha leído el modelo de visión
 * y la RESPUESTA CORRECTA que ha detectado el color verde.
 *
 * El modelo lee mejor el texto (entiende la estructura de la página), pero
 * tiende a marcar como correcta la que él cree por sus conocimientos en vez de
 * la que está pintada de verde. La detección del verde es aritmética sobre
 * píxeles y no se equivoca nunca. Así que el texto lo pone uno y la respuesta
 * el otro.
 */
export function combinar(deVision, delOcr) {
  const avisos = [...deVision.avisos];

  // Si el OCR ha sabido cuál es la verde y ambos ven el mismo número de
  // opciones, la posición se traslada tal cual.
  const mismasOpciones = delOcr?.opciones?.length === deVision.opciones.length;

  let correcta = deVision.correcta;
  if (delOcr?.correcta !== null && delOcr?.correcta !== undefined && mismasOpciones) {
    if (deVision.correcta !== null && deVision.correcta !== delOcr.correcta) {
      avisos.push(`El modelo señaló la opción ${'ABCD'[deVision.correcta]} pero la pintada de ` +
        `verde es la ${'ABCD'[delOcr.correcta]}. Manda el verde.`);
    }
    correcta = delOcr.correcta;
  } else if (delOcr && !mismasOpciones && delOcr.opciones?.length) {
    avisos.push(`El modelo ve ${deVision.opciones.length} opciones y el lector de texto ` +
      `${delOcr.opciones.length}: no se ha podido comprobar la respuesta con el verde.`);
  }

  return {
    ...deVision,
    correcta,
    idExterno: deVision.idExterno || delOcr?.idExterno || null,
    avisos,
  };
}
