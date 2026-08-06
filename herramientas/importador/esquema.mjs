// ---------------------------------------------------------------------------
// Elegir qué lámina acompaña a cada pregunta.
//
// El modelo no dibuja ni compone: sólo lee la pregunta y dice cuál de las
// láminas del catálogo le viene bien, o que ninguna. Es lo único que un modelo
// pequeño hace con fiabilidad, y de dibujar ya se encarga dibujos.mjs.
// ---------------------------------------------------------------------------

import { CATALOGO, NOMBRES, construirDibujo } from './dibujos.mjs';

export { CATALOGO, NOMBRES, construirDibujo };

/** La instrucción, con el catálogo desplegado para que elija. */
export function instruccionLamina() {
  const fichas = NOMBRES.map((n) => `- ${n}: ${CATALOGO[n].que}`).join('\n');
  return `Eres profesor de Automoción. Tienes un cuaderno con láminas ya dibujadas y
tienes que decir cuál acompaña mejor a una pregunta de test. NO dibujas nada:
sólo eliges.

Las láminas del cuaderno:

${fichas}

Responde ÚNICAMENTE con un objeto JSON, sin explicaciones ni markdown:

{"lamina":"nombre-de-la-lamina","titulo":""}

Reglas:
- "lamina" tiene que ser uno de los nombres de arriba, tal cual, o "ninguna".
- Elige "ninguna" si la pregunta no trata de ninguno de esos asuntos. Es la
  respuesta correcta la mayor parte de las veces: el cuaderno es pequeño y una
  lámina que no venga a cuento estorba más que ayuda.
- No elijas una lámina sólo porque comparta una palabra con la pregunta. Tiene
  que explicar lo que la pregunta pregunta.
- "titulo" puede ir vacío. Sólo ponlo si el título propio de la lámina no
  encaja con la pregunta, y entonces escribe uno de cinco palabras como mucho.`;
}

/** El mensaje con los datos de la pregunta. */
export function mensajeLamina(pregunta) {
  const partes = [
    `Pregunta: ${pregunta.pregunta}`,
    `Respuesta correcta: ${pregunta.opciones?.[pregunta.correcta] ?? ''}`,
  ];
  if (pregunta.explicacion) partes.push(`Explicación: ${pregunta.explicacion}`);
  if (pregunta.submodulo) partes.push(`Tema: ${pregunta.submodulo}`);
  return partes.join('\n');
}

/**
 * Saca la elección de lo que conteste el modelo, que casi nunca es JSON limpio:
 * viene con ```json alrededor, con texto delante o con el razonamiento por medio.
 */
export function leerEleccion(texto) {
  let t = String(texto ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  const inicio = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) return null;

  let datos;
  try { datos = JSON.parse(t.slice(inicio, fin + 1)); } catch { return null; }
  if (!datos || typeof datos !== 'object') return null;

  const lamina = String(datos.lamina ?? datos.dibujo ?? '').trim();
  if (lamina === 'ninguna') return { lamina: 'ninguna', titulo: '' };
  if (!NOMBRES.includes(lamina)) return null;

  return {
    lamina,
    titulo: String(datos.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 46),
  };
}

/** Le pide al modelo que elija, y devuelve la lámina construida. */
export async function generarEsquema(pregunta, { url, modelo, señal } = {}) {
  const r = await fetch(`${url.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: señal,
    body: JSON.stringify({
      model: modelo,
      stream: false,
      think: false,
      format: 'json',            // Ollama obliga a que la salida sea JSON válido
      options: { temperature: 0.1, num_predict: 300, num_ctx: 4096 },
      messages: [
        { role: 'system', content: instruccionLamina() },
        { role: 'user', content: mensajeLamina(pregunta) },
      ],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} · ${(await r.text()).slice(0, 200)}`);
  const datos = await r.json();
  const elegida = leerEleccion(datos.message?.content || '');
  if (!elegida || elegida.lamina === 'ninguna') return { datos: elegida, svg: null };
  return { datos: elegida, svg: construirDibujo(elegida.lamina, elegida.titulo) };
}
