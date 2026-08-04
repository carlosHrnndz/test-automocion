// ---------------------------------------------------------------------------
// Generación de explicación y ejemplo con Ollama, apoyándose en el PDF del tema.
// ---------------------------------------------------------------------------

const SIN_MATERIAL = `Eres profesor de Automoción en España. Escribes para un alumno de Grado Superior.

Recibirás una pregunta de test y su respuesta correcta. Responde EXACTAMENTE con este formato,
sin añadir nada más, sin markdown y sin asteriscos:

EXPLICACION: [2 o 3 frases explicando por qué esa respuesta es la correcta. Explica el
principio físico o el funcionamiento, no repitas la respuesta con otras palabras.]
EJEMPLO: [1 o 2 frases con un caso concreto de taller o de conducción.]

Reglas que no puedes saltarte:
- Español de España. Tutea al alumno.
- No inventes cifras, medidas, pares de apriete ni artículos de normativa.
  Si no estás seguro de un dato numérico, explica el principio general sin dar el número.
- No uses listas ni viñetas. Sólo las dos líneas del formato.`;

const CON_MATERIAL = `Eres profesor de Automoción en España. Escribes para un alumno de Grado Superior.

Recibirás un fragmento del temario, una pregunta de test y su respuesta correcta.
Responde EXACTAMENTE con este formato, sin añadir nada más, sin markdown y sin asteriscos:

EXPLICACION: [2 o 3 frases explicando por qué esa respuesta es la correcta.]
EJEMPLO: [1 o 2 frases con un caso concreto de taller o de conducción.]

Reglas que no puedes saltarte:
- Básate en el TEMARIO que te doy. Es la fuente buena.
- Si el temario no cubre la pregunta, explica el principio general y no te inventes datos.
- No des cifras, medidas ni pares de apriete que no aparezcan en el temario.
- Español de España. Tutea al alumno. Sin listas ni viñetas.`;

export function construirMensaje(pregunta, contexto = []) {
  const partes = [];
  if (contexto.length) {
    partes.push('TEMARIO:');
    contexto.forEach((c) => partes.push(`[pág. ${c.pagina}] ${c.texto}`));
    partes.push('');
  }
  partes.push(`Pregunta: ${pregunta.pregunta}`);
  pregunta.opciones.forEach((o, i) => partes.push(`${'ABCDEFGH'[i]}) ${o}`));
  partes.push(`Respuesta correcta: ${'ABCDEFGH'[pregunta.correcta]}) ${pregunta.opciones[pregunta.correcta]}`);
  if (pregunta.submodulo) partes.push(`Tema: ${pregunta.submodulo}`);
  return partes.join('\n');
}

export async function generar(pregunta, contexto, { url, modelo, señal } = {}) {
  const r = await fetch(`${url.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: señal,
    body: JSON.stringify({
      model: modelo,
      stream: false,
      think: false,
      options: {
        temperature: 0.3,
        // Holgado a propósito: los modelos que razonan (qwen3 y compañía)
        // gastan buena parte del presupuesto pensando antes de responder. Con
        // un límite corto se quedaban sin sitio para escribir la respuesta y
        // parecía que "no respetaban el formato".
        num_predict: 1500,
        num_ctx: contexto.length ? 4096 : 2048,
      },
      messages: [
        { role: 'system', content: contexto.length ? CON_MATERIAL : SIN_MATERIAL },
        { role: 'user', content: construirMensaje(pregunta, contexto) },
      ],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} · ${(await r.text()).slice(0, 200)}`);
  const datos = await r.json();
  // Algunos modelos devuelven el razonamiento aparte, en su propio campo.
  return (datos.message?.content || '').trim();
}

/** Quita el razonamiento que sueltan los modelos "pensantes" antes de responder. */
export function quitarRazonamiento(texto) {
  return String(texto)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    // A veces se queda abierto porque se acabó el presupuesto de salida.
    .replace(/<\/?think(?:ing)?>/gi, '')
    .trim();
}

/**
 * Saca EXPLICACION y EJEMPLO de la respuesta del modelo.
 *
 * Es deliberadamente tolerante: los modelos pequeños se saltan las etiquetas
 * la mitad de las veces, y tirar una respuesta buena sólo porque no puso
 * "EXPLICACION:" delante sería absurdo. Si no hay etiquetas pero hay dos
 * párrafos con pinta de explicación y ejemplo, se aprovechan igual.
 */
export function extraerCampos(texto) {
  let t = quitarRazonamiento(texto);
  t = t.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/```/g, '').trim();
  if (!t) return null;

  const limpia = (s) => String(s)
    .replace(/^\s*\[|\]\s*$/g, '')
    .replace(/^\s*[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const iExp = t.search(/EXPLICACI[OÓ]N\s*:/i);
  const iEje = t.search(/EJEMPLO\s*:/i);

  // Camino normal: el modelo ha usado las etiquetas.
  if (iExp !== -1) {
    let explicacion, ejemplo = '';
    if (iEje > iExp) {
      explicacion = t.slice(iExp, iEje).replace(/^EXPLICACI[OÓ]N\s*:/i, '');
      ejemplo = t.slice(iEje).replace(/^EJEMPLO\s*:/i, '');
    } else {
      explicacion = t.slice(iExp).replace(/^EXPLICACI[OÓ]N\s*:/i, '');
    }
    explicacion = limpia(explicacion);
    ejemplo = limpia(ejemplo);
    if (explicacion.length >= 20) return { explicacion, ejemplo };
  }

  // Sólo ha puesto la etiqueta del ejemplo: lo de antes es la explicación.
  if (iEje > 0) {
    const explicacion = limpia(t.slice(0, iEje));
    const ejemplo = limpia(t.slice(iEje).replace(/^EJEMPLO\s*:/i, ''));
    if (explicacion.length >= 20) return { explicacion, ejemplo };
  }

  // Sin etiquetas: dos párrafos son explicación y ejemplo; uno solo, explicación.
  const parrafos = t.split(/\n\s*\n/).map(limpia).filter((p) => p.length >= 20);
  if (parrafos.length >= 2) {
    return { explicacion: parrafos[0], ejemplo: parrafos[1] };
  }
  if (parrafos.length === 1 && parrafos[0].length >= 40) {
    // Un único bloque: si hay una frase que suena a ejemplo, se separa.
    const frases = parrafos[0].split(/(?<=\.)\s+/);
    const iEjemplo = frases.findIndex((f) =>
      /^(por ejemplo|un ejemplo|imagina|piensa en|en el taller|si alguna vez)/i.test(f));
    if (iEjemplo > 0) {
      return {
        explicacion: frases.slice(0, iEjemplo).join(' ').trim(),
        ejemplo: frases.slice(iEjemplo).join(' ').trim(),
      };
    }
    return { explicacion: parrafos[0], ejemplo: '' };
  }

  return null;
}

export async function comprobarOllama(url) {
  const r = await fetch(`${url.replace(/\/+$/, '')}/api/tags`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { models = [] } = await r.json();
  return models.map((m) => m.name);
}
