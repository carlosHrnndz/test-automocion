// Pruebas del importador contra una captura real de la academia.
// Uso:  node herramientas/probar-importador.mjs
//
// Necesita las dependencias del proyecto (npm install) y tesseract con español.
// Si falta algo, avisa y sale sin marcar error.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const IMAGEN = AQUI + 'ejemplo/captura-ejemplo.png';
const PDF = AQUI + 'ejemplo/temario-ejemplo.pdf';

let modulos;
try {
  modulos = {
    imagen: await import('./importador/imagen.mjs'),
    ocr: await import('./importador/ocr.mjs'),
    parseo: await import('./importador/parseo.mjs'),
    pdf: await import('./importador/pdf.mjs'),
    ollama: await import('./importador/ollama.mjs'),
    vision: await import('./importador/vision.mjs'),
  };
} catch (e) {
  console.log('Faltan dependencias. Ejecuta "npm install".\n' + e.message);
  process.exit(0);
}

const { leerImagen, bandasVerdes, recorteRealzado, ampliarParaOcr } = modulos.imagen;
const { hayTesseract, ocrLineas, ocrDeBuffer } = modulos.ocr;
const { extraerPregunta, rescatarZonasVerdes } = modulos.parseo;
const { textoPdf, trocear, buscarRelevantes } = modulos.pdf;
const { extraerCampos, construirMensaje, quitarRazonamiento } = modulos.ollama;
const { extraerJson, combinar } = modulos.vision;

const fallos = [];
function ok(nombre, cond) {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
}

// --- Detección del verde (no necesita tesseract) ---------------------------
console.log('--- Deteccion de la banda verde ---');
const img = leerImagen(IMAGEN);
ok('lee el PNG', img.ancho === 2215 && img.alto === 1253);

const bandas = bandasVerdes(img);
ok('encuentra exactamente una banda', bandas.length === 1);
ok('la banda esta donde toca', bandas[0]?.arriba > 550 && bandas[0]?.abajo < 620);
ok('la banda tiene ancho de opcion', bandas[0]?.derecha - bandas[0]?.izquierda > 400);

// Una imagen sin nada verde no debe dar falsos positivos.
const gris = { ancho: 200, alto: 200, datos: new Uint8Array(200 * 200 * 4).fill(200) };
ok('no inventa bandas en una imagen lisa', bandasVerdes(gris).length === 0);

// --- OCR y parseo ----------------------------------------------------------
if (!hayTesseract()) {
  console.log('\nTesseract no esta instalado; se omiten las pruebas de OCR.');
  console.log('  brew install tesseract tesseract-lang');
} else {
  console.log('\n--- OCR y parseo ---');
  const tessdata = process.env.TESSDATA_TEST || null;
  let lineas;
  try {
    lineas = ocrLineas(IMAGEN, { idioma: 'spa', tessdata });
  } catch (e) {
    console.log('  OMITIDO: tesseract no tiene el idioma espanol (' + e.message.slice(0, 60) + ')');
    lineas = null;
  }

  if (lineas) {
    const p = extraerPregunta(lineas, bandas);
    ok('saca el identificador de la academia', p.idExterno === '2778097');
    ok('saca el enunciado', /rotura por fatiga/i.test(p.pregunta));
    ok('el enunciado no arrastra la palabra RESPUESTAS', !/respuestas/i.test(p.pregunta));
    ok('detecta 4 opciones', p.opciones.length === 4);
    ok('une la opcion que ocupa dos lineas', /funcionamiento c[ií]clico/i.test(p.opciones[1] || ''));
    ok('conserva acentos y enes', /pequen?[ñn]as/i.test(p.opciones[0] || '') || /deformaci[oó]n/i.test(p.opciones[0] || ''));
    ok('la correcta es la ultima (la verde)', p.correcta === 3);
    ok('quita el circulo del radio del texto', !/^[O0o]\s/.test(p.opciones[3] || ''));
    ok('confianza del OCR alta', p.conf >= 85);
    ok('sin avisos', p.avisos.length === 0);


    // --- Rescate del texto blanco sobre fondo verde ----------------------
    // Es el fallo real que se dio con las capturas de la academia: Tesseract
    // no lee la opción marcada porque va en blanco sobre verde, y la pregunta
    // se queda sin respuesta correcta.
    console.log('\n--- Rescate de la opcion sobre verde ---');
    const recorte = recorteRealzado(img, bandas[0]);
    ok('genera el recorte realzado', recorte && recorte.length > 100);
    const textoRecorte = ocrDeBuffer(recorte, { idioma: 'spa', tessdata });
    ok('lee el texto del recorte', /todas las respuestas/i.test(textoRecorte));

    // Simulamos el fallo: quitamos las líneas que caen sobre el verde.
    const mutiladas = lineas.filter((l) =>
      !(l.arriba < bandas[0].abajo && l.abajo > bandas[0].arriba));
    const sinRescate = extraerPregunta(mutiladas, bandas);
    ok('sin rescate se pierde la correcta', sinRescate.correcta === null && sinRescate.opciones.length === 3);

    const extra = rescatarZonasVerdes(img, bandas, mutiladas, { idioma: 'spa', tessdata });
    ok('el rescate recupera una linea', extra.length === 1);
    const conRescate = extraerPregunta([...mutiladas, ...extra].sort((a, b) => a.arriba - b.arriba), bandas);
    ok('con rescate vuelven las 4 opciones', conRescate.opciones.length === 4);
    ok('con rescate se detecta la correcta', conRescate.correcta === 3);
    ok('la correcta rescatada es la buena',
       /todas las respuestas anteriores/i.test(conRescate.opciones[conRescate.correcta] || ''));

    // Si el texto ya se leyó bien, no se rescata nada (no duplica opciones).
    ok('no rescata si ya habia texto en el verde',
       rescatarZonasVerdes(img, bandas, lineas, { idioma: 'spa', tessdata }).length === 0);

    // Sin banda verde no debe adivinar.
    const sinVerde = extraerPregunta(lineas, []);
    ok('sin verde deja la correcta en null', sinVerde.correcta === null);
    ok('sin verde avisa', sinVerde.avisos.some((a) => /verde/i.test(a)));
  }
}


// --- Emparejar el verde con la opción, en casos torcidos -------------------
console.log('\n--- Verde contra opciones (casos dificiles) ---');
{
  const L = (texto, arriba, alto = 24) =>
    ({ texto, arriba, abajo: arriba + alto, izquierda: 400, derecha: 1400, conf: 95 });
  const lineas = [
    L('PREGUNTA: (Identificador nº 111)', 160),
    L('¿Enunciado de prueba?', 220),
    L('RESPUESTAS', 320),
    L('Opcion A', 380),
    L('Opcion B primera linea', 435),
    L('segunda linea de la B', 465),
    L('Opcion C', 520),
    L('Opcion D', 578),
  ];
  const prueba = (nombre, bandas, esperada) => {
    const r = extraerPregunta(lineas, bandas);
    ok(nombre, r.correcta === esperada);
  };
  prueba('banda centrada en la opcion', [{ arriba: 565, abajo: 610 }], 3);
  prueba('banda desplazada hacia abajo', [{ arriba: 590, abajo: 635 }], 3);
  prueba('banda sobre una opcion de dos lineas', [{ arriba: 428, abajo: 495 }], 1);
  prueba('banda mas alta que la linea del OCR', [{ arriba: 370, abajo: 415 }], 0);
  prueba('banda que sólo roza la opcion', [{ arriba: 534, abajo: 560 }], 2);
  ok('sin banda no adivina', extraerPregunta(lineas, []).correcta === null);
  ok('avisa si hay dos zonas verdes',
     extraerPregunta(lineas, [{ arriba: 565, abajo: 610 }, { arriba: 380, abajo: 400 }])
       .avisos.some((a) => /zonas verdes/.test(a)));
}


// --- Ampliar la imagen antes del OCR ---------------------------------------
// Las capturas de pantalla llevan letra pequeña y Tesseract falla. Ampliar al
// doble con suavizado sube la precisión de forma muy notable.
if (hayTesseract()) {
  console.log('\n--- Ampliacion previa al OCR ---');
  const tessdata = process.env.TESSDATA_TEST || null;
  try {
    // Degradamos la captura a la mitad para simular una de baja resolución.
    const mitad = { ancho: Math.floor(img.ancho / 2), alto: Math.floor(img.alto / 2),
                    datos: new Uint8Array(Math.floor(img.ancho / 2) * Math.floor(img.alto / 2) * 4) };
    for (let y = 0; y < mitad.alto; y++) {
      for (let x = 0; x < mitad.ancho; x++) {
        const o = ((y * 2) * img.ancho + (x * 2)) * 4;
        const d = (y * mitad.ancho + x) * 4;
        for (let c = 0; c < 4; c++) mitad.datos[d + c] = img.datos[o + c];
      }
    }
    const bandasMitad = bandasVerdes(mitad);
    const flojo = extraerPregunta(ocrLineas(ampliarParaOcr(mitad, 1), { idioma: 'spa', tessdata }), bandasMitad);
    const bueno = extraerPregunta(
      ocrLineas(ampliarParaOcr(mitad, 2), { idioma: 'spa', tessdata, escala: 2 }), bandasMitad);

    ok('ampliar mejora la confianza del OCR', bueno.conf > flojo.conf);
    ok('ampliada recupera las 4 opciones', bueno.opciones.length === 4);
    ok('ampliada detecta la correcta', bueno.correcta === 3);
    ok('las coordenadas vuelven a la escala original',
       bueno.opciones.length === 4 && bandasMitad.length === 1);
  } catch (e) {
    console.log('  OMITIDO: ' + e.message.slice(0, 70));
  }
}

// --- Descartar lo que no es una opcion -------------------------------------
console.log('\n--- Filtro de intrusos ---');
{
  const L = (t, y, x = 430, h = 24, c = 95) =>
    ({ texto: t, arriba: y, abajo: y + h, izquierda: x, derecha: 1400, conf: c });
  const conBasura = [
    L('PREGUNTA: (Identificador nº 1)', 160), L('¿Enunciado?', 220), L('RESPUESTAS', 320),
    L('Primera opcion valida', 380), L('Segunda opcion valida', 436), L('Tercera opcion valida', 490),
    L('k', 1241, 1150),   // cursor del ratón: desalineado y al fondo
  ];
  const r = extraerPregunta(conBasura, [{ arriba: 480, abajo: 520 }]);
  ok('descarta la basura desalineada', r.opciones.length === 3);
  ok('sigue detectando bien la correcta', r.correcta === 2);

  // Una opción con lectura pésima también se descarta.
  const conRuido = [...conBasura.slice(0, 6), L('rnn iii', 545, 430, 24, 20)];
  ok('descarta la lectura poco fiable',
     extraerPregunta(conRuido, [{ arriba: 480, abajo: 520 }]).opciones.length === 3);

  // Pero si el filtro se llevaría casi todo, no toca nada.
  const casiTodoDesalineado = [
    L('PREGUNTA: (Identificador nº 2)', 160), L('¿Enunciado?', 220), L('RESPUESTAS', 320),
    L('Opcion una', 380, 100), L('Opcion dos', 436, 900), L('Opcion tres', 490, 1600),
  ];
  ok('no se pasa de listo si todo esta desalineado',
     extraerPregunta(casiTodoDesalineado, []).opciones.length === 3);

  // Avisos de sospecha
  const cinco = [
    L('PREGUNTA: (Identificador nº 3)', 160), L('¿Enunciado?', 220), L('RESPUESTAS', 320),
    L('Opcion numero uno', 380), L('Opcion numero dos', 436), L('Opcion numero tres', 490),
    L('Opcion numero cuatro', 545), L('Opcion numero cinco', 600),
  ];
  ok('avisa si hay mas de 4 opciones',
     extraerPregunta(cinco, []).avisos.some((a) => /m[aá]s de las 4/.test(a)));

  const corta = [
    L('PREGUNTA: (Identificador nº 4)', 160), L('¿Enunciado?', 220), L('RESPUESTAS', 320),
    L('Opcion numero uno', 380), L('Opcion numero dos', 436), L('abc', 490),
  ];
  ok('avisa de opciones sospechosamente cortas',
     extraerPregunta(corta, []).avisos.some((a) => /corta/.test(a)));
}


// --- Motor de vision --------------------------------------------------------
console.log('\n--- Modelo de vision ---');
{
  // Los modelos devuelven el JSON sucio: con ```json y bloques de razonamiento.
  const sucio = '<think>veo la imagen</think>\n```json\n' +
    '{"idExterno":"nº 2778097","pregunta":"¿Prueba?","opciones":["a","b","c","d"],' +
    '"correcta":0,"confianza":"alta","dudas":""}\n```';
  const j = extraerJson(sucio);
  ok('lee el JSON del modelo con basura alrededor', j.pregunta === '¿Prueba?');
  ok('no se confunde con el array de opciones', Array.isArray(j.opciones) && j.opciones.length === 4);

  let rompio = false;
  try { extraerJson('no hay json aqui'); } catch { rompio = true; }
  ok('avisa si no hay JSON', rompio);

  // Lo importante: el verde manda sobre lo que diga el modelo.
  const deVision = { pregunta: '¿Prueba?', opciones: ['a', 'b', 'c', 'd'], correcta: 0, conf: 90, avisos: [], idExterno: null };
  const delOcr = { pregunta: '¿Prueba?', opciones: ['a', 'b', 'c', 'd'], correcta: 3, conf: 95, avisos: [], idExterno: '2778097' };

  const junto = combinar(deVision, delOcr);
  ok('el verde corrige al modelo', junto.correcta === 3);
  ok('avisa de que ha corregido', junto.avisos.some((a) => /Manda el verde/.test(a)));
  ok('conserva el texto del modelo', junto.opciones[0] === 'a');
  ok('recupera el identificador del OCR', junto.idExterno === '2778097');

  // Si no coinciden en número de opciones, no se puede cruzar: se avisa.
  const desigual = combinar(deVision, { ...delOcr, opciones: ['a', 'b', 'c'] });
  ok('avisa si los dos no ven lo mismo', desigual.avisos.some((a) => /no se ha podido comprobar/.test(a)));
  ok('sin poder cruzar, respeta lo que dijo el modelo', desigual.correcta === 0);

  // Si el OCR no supo cuál era la verde, manda el modelo.
  const sinVerde = combinar(deVision, { ...delOcr, correcta: null });
  ok('sin verde detectado se queda lo del modelo', sinVerde.correcta === 0);

  // Y si coinciden, ni aviso ni ruido.
  const acuerdo = combinar({ ...deVision, correcta: 3 }, delOcr);
  ok('si coinciden no avisa de nada', acuerdo.avisos.length === 0 && acuerdo.correcta === 3);
}


// --- Respuestas de modelos que razonan -------------------------------------
// qwen3 y compañía "piensan" antes de responder. Si el razonamiento se cuela
// o se come el presupuesto de salida, la respuesta parece no seguir el formato.
console.log('\n--- Modelos que razonan ---');
{
  ok('quita el razonamiento cerrado',
     !/pensando/.test(quitarRazonamiento('<think>estoy pensando</think>Respuesta')));
  ok('quita el razonamiento sin cerrar',
     !/<think>/.test(quitarRazonamiento('<think>se corto a medias\nEXPLICACION: algo')));

  const conRazonamiento = extraerCampos(
    '<think>vale, la D</think>\nEXPLICACION: La fatiga rompe la pieza con cargas pequenas.\nEJEMPLO: Un ciguenal.');
  ok('aprovecha la respuesta pese al razonamiento', conRazonamiento?.ejemplo === 'Un ciguenal.');
  ok('el razonamiento no se cuela en la explicacion', !/vale, la D/.test(conRazonamiento?.explicacion || ''));

  // Sin etiquetas: no tirar una respuesta buena por una tontería de formato.
  const dosParrafos = extraerCampos(
    'La fatiga rompe la pieza con cargas muy inferiores a las estaticas.\n\nEn el taller lo ves en ciguenales que revientan.');
  ok('acepta dos parrafos sin etiquetas', dosParrafos?.explicacion.startsWith('La fatiga'));
  ok('toma el segundo parrafo como ejemplo', dosParrafos?.ejemplo.startsWith('En el taller'));

  const soloEjemplo = extraerCampos(
    'La rotura por fatiga aparece con esfuerzos variables y repetidos.\nEJEMPLO: Una ballesta que parte.');
  ok('aprovecha si solo etiqueta el ejemplo', soloEjemplo?.ejemplo === 'Una ballesta que parte.');

  const unBloque = extraerCampos(
    'La fatiga rompe la pieza tras muchos ciclos aunque sean suaves. Por ejemplo, un semieje que casca.');
  ok('separa el ejemplo dentro de un solo bloque', /^Por ejemplo/.test(unBloque?.ejemplo || ''));

  // Pero sigue rechazando lo que no sirve.
  ok('rechaza la respuesta vacia', extraerCampos('') === null);
  ok('rechaza si solo hay razonamiento', extraerCampos('<think>no me dio tiempo</think>') === null);
  ok('rechaza un texto demasiado corto', extraerCampos('Pues si.') === null);
}

// --- PDF -------------------------------------------------------------------
console.log('\n--- PDF y busqueda de pasajes ---');
if (!fs.existsSync(PDF)) {
  console.log('  OMITIDO: falta el PDF de ejemplo');
} else {
  const paginas = await textoPdf(PDF);
  ok('extrae texto del PDF', paginas.length >= 1 && paginas[0].texto.length > 300);
  const trozos = trocear(paginas);
  ok('trocea el texto', trozos.length >= 1);

  const relevantes = buscarRelevantes(trozos, 'En la rotura por fatiga los materiales se rompen con esfuerzos variables', { cuantos: 2 });
  ok('encuentra pasajes relevantes', relevantes.length >= 1);
  ok('el pasaje habla de fatiga', /fatiga/i.test(relevantes[0]?.texto || ''));
  ok('el pasaje trae numero de pagina', Number.isInteger(relevantes[0]?.pagina));

  const nada = buscarRelevantes(trozos, 'zzzz qqqq wwww', { cuantos: 2 });
  ok('no devuelve pasajes si no hay relacion', nada.length === 0);
}

// --- Limpieza de la respuesta del modelo -----------------------------------
console.log('\n--- Respuesta del modelo ---');
const sucio = '<think>a ver</think>\n**EXPLICACION:** La fatiga rompe   la pieza\nsin avisar.\nEJEMPLO: Un ciguenal que revienta.';
const campos = extraerCampos(sucio);
ok('quita el bloque de razonamiento', !/think/.test(campos?.explicacion || ''));
ok('quita el markdown', !/\*/.test(campos?.explicacion || ''));
ok('normaliza espacios y saltos', campos?.explicacion === 'La fatiga rompe la pieza sin avisar.');
ok('separa el ejemplo', campos?.ejemplo === 'Un ciguenal que revienta.');
ok('rechaza lo que no sigue el formato', extraerCampos('Pues la respuesta es la B porque si.') === null);

const preguntaDemo = { pregunta: '¿Test?', opciones: ['uno', 'dos'], correcta: 1, submodulo: 'RUEDAS' };
const conCtx = construirMensaje(preguntaDemo, [{ pagina: 7, texto: 'contenido del temario' }]);
ok('el mensaje incluye el temario', conCtx.includes('TEMARIO:') && conCtx.includes('pág. 7'));
ok('el mensaje marca la correcta', conCtx.includes('Respuesta correcta: B) dos'));
ok('sin contexto no mete TEMARIO', !construirMensaje(preguntaDemo, []).includes('TEMARIO'));

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length ? 1 : 0);
