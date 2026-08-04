// ---------------------------------------------------------------------------
// OCR con Tesseract. Se le pide salida TSV para saber dónde está cada palabra:
// sin las coordenadas no podríamos cruzar el texto con la banda verde.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';

export function hayTesseract() {
  try {
    execFileSync('tesseract', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function idiomasDisponibles(tessdata = null) {
  const args = ['--list-langs'];
  if (tessdata) args.push('--tessdata-dir', tessdata);
  try {
    // tesseract escribe la lista por stderr en unas versiones y por stdout en otras.
    const salida = execFileSync('tesseract', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return salida.split('\n').slice(1).map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    const texto = String(e.stdout || '') + String(e.stderr || '');
    return texto.split('\n').slice(1).map((s) => s.trim()).filter(Boolean);
  }
}

/**
 * Devuelve las líneas de texto detectadas, cada una con su caja:
 * [{ texto, arriba, abajo, izquierda, derecha, conf }]
 */
/**
 * OCR de un trozo pequeño de imagen que ya tenemos en memoria (un Buffer PNG).
 * Se usa para rescatar la opción marcada en verde, que suele venir en texto
 * blanco sobre fondo de color y se le escapa a la pasada normal.
 *
 * psm 7 = "esto es una sola línea de texto", que es lo que mejor funciona
 * en una franja recortada. Si sale vacío se reintenta con psm 6 (bloque).
 */
export function ocrDeBuffer(buffer, { idioma = 'spa', tessdata = null } = {}) {
  for (const psm of ['7', '6']) {
    const args = ['stdin', 'stdout', '-l', idioma, '--psm', psm];
    if (tessdata) args.push('--tessdata-dir', tessdata);
    try {
      const salida = execFileSync('tesseract', args, {
        input: buffer,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const texto = salida.replace(/\s+/g, ' ').trim();
      if (texto.replace(/[^\p{L}\p{N}]/gu, '').length >= 4) return texto;
    } catch { /* probamos el siguiente psm */ }
  }
  return '';
}

/**
 * @param {string|Buffer} entrada  Ruta de la imagen o su contenido ya en memoria.
 * @param {number} escala  Si la imagen viene ampliada, el factor usado. Las
 *                         coordenadas se dividen por él para devolverlas
 *                         referidas al tamaño original.
 */
export function ocrLineas(entrada, { idioma = 'spa', psm = '6', tessdata = null, escala = 1 } = {}) {
  const esBuffer = Buffer.isBuffer(entrada);
  const args = [esBuffer ? 'stdin' : entrada, 'stdout', '-l', idioma, '--psm', psm];
  if (tessdata) args.push('--tessdata-dir', tessdata);
  args.push('tsv');

  const tsv = execFileSync('tesseract', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(esBuffer
      ? { input: entrada, stdio: ['pipe', 'pipe', 'ignore'] }
      : { stdio: ['ignore', 'pipe', 'ignore'] }),
  });

  const filas = tsv.split('\n');
  const cabecera = filas[0].split('\t');
  const col = Object.fromEntries(cabecera.map((c, i) => [c.trim(), i]));

  const porLinea = new Map();
  for (let i = 1; i < filas.length; i++) {
    const c = filas[i].split('\t');
    if (c.length < cabecera.length) continue;
    const texto = (c[col.text] ?? '').trim();
    const conf = Number(c[col.conf]);
    if (!texto || !Number.isFinite(conf) || conf < 0) continue;

    const clave = `${c[col.block_num]}|${c[col.par_num]}|${c[col.line_num]}`;
    const izquierda = Number(c[col.left]);
    const arriba = Number(c[col.top]);
    const ancho = Number(c[col.width]);
    const alto = Number(c[col.height]);

    if (!porLinea.has(clave)) {
      porLinea.set(clave, {
        palabras: [], arriba, abajo: arriba + alto,
        izquierda, derecha: izquierda + ancho, confs: [],
      });
    }
    const l = porLinea.get(clave);
    l.palabras.push(texto);
    l.confs.push(conf);
    l.arriba = Math.min(l.arriba, arriba);
    l.abajo = Math.max(l.abajo, arriba + alto);
    l.izquierda = Math.min(l.izquierda, izquierda);
    l.derecha = Math.max(l.derecha, izquierda + ancho);
  }

  return [...porLinea.values()]
    .map((l) => ({
      texto: l.palabras.join(' '),
      arriba: Math.round(l.arriba / escala),
      abajo: Math.round(l.abajo / escala),
      izquierda: Math.round(l.izquierda / escala),
      derecha: Math.round(l.derecha / escala),
      conf: Math.round(l.confs.reduce((a, b) => a + b, 0) / l.confs.length),
    }))
    .sort((a, b) => a.arriba - b.arriba);
}
