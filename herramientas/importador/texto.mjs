// ---------------------------------------------------------------------------
// Analizador de preguntas pegadas en texto.
//
// Este módulo es la ÚNICA fuente de verdad del analizador. herramientas/
// capturador.html lleva una copia literal de este mismo código para poder
// funcionar sin servidor; probar-analizador.mjs comprueba que las dos no se
// hayan desincronizado.
// ---------------------------------------------------------------------------

const slug = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Quita marcas de "esta es la correcta" y dice si las había.
function extraerMarca(texto){
  let t = texto.trim();
  let marcada = false;

  // **texto**  ->  correcta
  const negrita = t.match(/^\*\*(.+?)\*\*$/);
  if(negrita){ return { texto: negrita[1].trim(), marcada: true }; }

  // marcas al final
  const finales = /\s*(?:\*{1,3}|✓|✔|√|\[\s*[xX]\s*\]|\(\s*(?:correcta?|ok|v)\s*\)|<--+|<=+|#)\s*$/;
  if(finales.test(t)){ t = t.replace(finales,'').trim(); marcada = true; }

  // marcas al principio (antes o después de la letra ya retirada)
  const iniciales = /^(?:\*{1,3}|✓|✔|√|>{1,2}|\[\s*[xX]\s*\])\s+/;
  if(iniciales.test(t)){ t = t.replace(iniciales,'').trim(); marcada = true; }

  return { texto: t, marcada };
}

const RE_LETRA   = /^\s*([*>✓✔]\s*)?([a-hA-H])\s*[).\-–:]\s*(.+)$/;
const RE_NUMERO  = /^\s*([*>✓✔]\s*)?(\d{1,3})\s*[).\-–:]\s*(.+)$/;
const RE_VINETA  = /^\s*[-•–●▪]\s+(.+)$/;
// "Respuesta correcta: b" — exige separador para no confundirse con la palabra "Respuestas" suelta.
const RE_RESP    = /^\s*(?:respuestas?|soluci[oó]n(?:es)?|correcta|resp\.?)\s*(?:correcta)?\s*(?:[:\-–]\s*|\s+)([a-hA-H]|\d{1,2})\b/i;
// Línea que sólo dice "Respuestas" y separa el enunciado de las opciones.
const RE_SEPARADOR = /^\s*(?:respuestas?|opciones|alternativas)\s*[:.]?\s*$/i;
// "PREGUNTA: (Identificador nº 2778104)" o "Pregunta 4: ¿…?"
const RE_CABECERA= /^\s*(?:pregunta|preg\.?|cuesti[oó]n)\b\s*(\d{1,4})?\s*[:).\-–]?\s*(.*)$/i;
const RE_ID_EXT  = /^\(\s*(?:identificador|id|c[oó]digo)\b[^)]*?(\d{2,})\s*\)\s*(.*)$/i;
const RE_RUIDO   = /^\s*(?:p[aá]gina\s*\d+|\d+\s*\/\s*\d+|-{3,}|={3,}|_{3,})\s*$/i;

/**
 * Convierte texto pegado en un array de preguntas.
 * Devuelve { preguntas, incidencias }.
 */
function analizar(texto){
  const lineas = texto.replace(/\u00A0/g,' ').split(/\r?\n/);
  const preguntas = [];
  const incidencias = [];
  let actual = null;
  // esperando | enunciado | opciones | libres
  //   "libres" = ya sabemos que todo lo que venga son opciones, aunque no lleven
  //   letra ni guion delante. Se activa con la línea "Respuestas".
  let estado = 'esperando';

  const cerrar = () => {
    if(actual && actual.opciones.length >= 2){
      preguntas.push(actual);
    } else if(actual && actual.pregunta){
      incidencias.push(`Descartada por tener menos de 2 opciones: "${actual.pregunta.slice(0,60)}…"`);
    }
    actual = null;
    estado = 'esperando';
  };

  const abrir = (enunciado, cabecera = false) => {
    cerrar();
    actual = { pregunta: enunciado.trim(), opciones: [], correcta: null, cabecera, idExterno: null };
    estado = (cabecera || enunciado.trim()) ? 'enunciado' : 'esperando';
  };

  const añadirOpcion = (bruto, libre = false) => {
    if(!actual) return;
    const { texto:t, marcada } = extraerMarca(bruto);
    if(!t) return;
    actual.opciones.push(t);
    if(marcada) actual.correcta = actual.opciones.length - 1;
    estado = libre ? 'libres' : 'opciones';
  };

  for(let i=0; i<lineas.length; i++){
    const linea = lineas[i];
    const limpia = linea.trim();

    if(!limpia){ if(estado === 'opciones' || estado === 'libres') cerrar(); continue; }
    if(RE_RUIDO.test(limpia)) continue;

    // ¿Línea "Respuestas" que separa enunciado de opciones?
    if(RE_SEPARADOR.test(limpia)){
      if(actual) estado = 'libres';
      continue;
    }

    // ¿Cabecera "PREGUNTA: (Identificador nº 1234)"?
    if(/^(pregunta|preg\b|preg\.|cuesti)/i.test(limpia)){
      const mCab = limpia.match(RE_CABECERA);
      if(mCab){
        let resto = (mCab[2] || '').trim();
        let idExterno = null;
        const mId = resto.match(RE_ID_EXT);
        if(mId){ idExterno = mId[1]; resto = (mId[2] || '').trim(); }
        abrir(resto, true);
        actual.idExterno = idExterno;
        continue;
      }
    }

    // ¿Respuesta declarada en línea aparte?
    const mResp = limpia.match(RE_RESP);
    if(mResp && actual && actual.opciones.length){
      const v = mResp[1];
      const idx = /\d/.test(v) ? Number(v) - 1 : v.toLowerCase().charCodeAt(0) - 97;
      if(idx >= 0 && idx < actual.opciones.length) actual.correcta = idx;
      else incidencias.push(`Respuesta "${v}" fuera de rango en "${actual.pregunta.slice(0,50)}…"`);
      continue;
    }

    // ¿Opción con letra?
    const mLetra = limpia.match(RE_LETRA);
    if(mLetra && actual){
      const marca = mLetra[1] || '';
      const letra = mLetra[2].toLowerCase();
      const esperada = String.fromCharCode(97 + actual.opciones.length);
      if(letra !== esperada && actual.opciones.length > 0){
        incidencias.push(`Opcion "${letra})" fuera de orden en "${actual.pregunta.slice(0,50)}..."`);
      }
      añadirOpcion(marca + mLetra[3]);
      continue;
    }

    // ¿Opción con viñeta?
    const mVin = limpia.match(RE_VINETA);
    if(mVin && actual && estado !== 'esperando'){
      añadirOpcion(mVin[1]);
      continue;
    }

    // ¿Número? Puede ser opción numerada o el número de una pregunta nueva.
    const mNum = limpia.match(RE_NUMERO);
    if(mNum){
      const n = Number(mNum[2]);
      const esSiguienteOpcion = actual && estado === 'opciones' && n === actual.opciones.length + 1;
      const esPrimeraOpcion   = actual && estado === 'enunciado' && n === 1;
      if(esSiguienteOpcion || esPrimeraOpcion){
        añadirOpcion((mNum[1] || '') + mNum[3]);
        continue;
      }
      abrir(mNum[3]);
      continue;
    }

    // Texto suelto, sin ninguna marca.
    if(estado === 'libres'){
      // Estamos dentro del listado de respuestas: cada línea es una opción.
      añadirOpcion(limpia, true);
    } else if(estado === 'opciones'){
      // Veníamos de opciones con marca: lo normal es que empiece otra pregunta.
      abrir(limpia);
    } else if(estado === 'enunciado'){
      // Con cabecera "PREGUNTA:" el enunciado termina en ? : . o !, y a partir
      // de ahí todo lo que venga son opciones aunque no lleven letra.
      if(actual.cabecera && actual.pregunta && /[?:.!]$/.test(actual.pregunta)){
        añadirOpcion(limpia, true);
      } else {
        actual.pregunta = actual.pregunta ? actual.pregunta + ' ' + limpia : limpia;
      }
    } else {
      abrir(limpia);
    }
  }
  cerrar();

  return { preguntas, incidencias };
}

/** Clave para detectar duplicados: identificador de la academia o enunciado. */
export const clavePregunta = (p) =>
  p.idExterno ? 'ext:' + p.idExterno : slug(p.pregunta).slice(0, 80);

export { analizar, extraerMarca, slug };
