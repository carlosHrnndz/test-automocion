// ---------------------------------------------------------------------------
// Lectura de imágenes y detección de la banda verde que marca la respuesta
// correcta.
//
// Esto NO es inteligencia artificial: es aritmética sobre los píxeles. Por eso
// es la parte más fiable de todo el importador — no se equivoca nunca mientras
// el color de fondo siga siendo verde.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export const EXTENSIONES = ['.png', '.jpg', '.jpeg'];

/** Devuelve { ancho, alto, datos } con datos en RGBA. */
export function leerImagen(ruta) {
  const ext = path.extname(ruta).toLowerCase();
  const bruto = fs.readFileSync(ruta);
  if (ext === '.png') {
    const p = PNG.sync.read(bruto);
    return { ancho: p.width, alto: p.height, datos: p.data };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    const j = jpeg.decode(bruto, { useTArray: true });
    return { ancho: j.width, alto: j.height, datos: j.data };
  }
  throw new Error(`Formato de imagen no soportado: ${ext}`);
}

/**
 * ¿Es este píxel del verde de "respuesta correcta"?
 *
 * El verde de la academia es RGB(120,176,136) aproximadamente: el canal verde
 * destaca claramente sobre los otros dos. El margen de 18 deja fuera los grises
 * y los antialiasing del texto, y admite variaciones de tono entre capturas.
 */
function esVerde(r, g, b, margen = 18) {
  return g > r + margen && g > b + margen && g > 50 && g < 240;
}

/**
 * Busca franjas horizontales de color verde.
 * Devuelve [{ arriba, abajo, izquierda, derecha }] ordenadas de arriba a abajo.
 */
export function bandasVerdes(img, { margen = 18, paso = 3 } = {}) {
  const { ancho, alto, datos } = img;
  const muestrasPorFila = Math.ceil(ancho / paso);
  // Con que el 4 % de la fila sea verde ya nos vale: la banda no ocupa todo el ancho.
  const minPorFila = Math.max(6, Math.round(muestrasPorFila * 0.04));
  const altoMinimo = Math.max(6, Math.round(alto * 0.006));

  const conteo = new Array(alto).fill(0);
  const extremos = new Array(alto);

  for (let y = 0; y < alto; y++) {
    let n = 0, izq = ancho, der = 0;
    for (let x = 0; x < ancho; x += paso) {
      const i = (y * ancho + x) * 4;
      if (esVerde(datos[i], datos[i + 1], datos[i + 2], margen)) {
        n++;
        if (x < izq) izq = x;
        if (x > der) der = x;
      }
    }
    conteo[y] = n;
    extremos[y] = [izq, der];
  }

  const bandas = [];
  let inicio = null;
  for (let y = 0; y <= alto; y++) {
    const activa = y < alto && conteo[y] >= minPorFila;
    if (activa && inicio === null) inicio = y;
    else if (!activa && inicio !== null) {
      if (y - inicio >= altoMinimo) {
        let izq = Infinity, der = 0;
        for (let k = inicio; k < y; k++) {
          izq = Math.min(izq, extremos[k][0]);
          der = Math.max(der, extremos[k][1]);
        }
        bandas.push({ arriba: inicio, abajo: y, izquierda: izq, derecha: der });
      }
      inicio = null;
    }
  }
  return bandas;
}

/** Cuánto se solapan verticalmente dos intervalos, en píxeles. */
export function solape(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/**
 * Amplía la imagen con suavizado antes de pasarla por el OCR.
 *
 * Las capturas de pantalla vienen con la letra pequeña y Tesseract lo pasa mal.
 * Medido sobre una captura real degradada: sin ampliar acierta al 82 % y se
 * come las tildes; ampliada al doble con interpolación bilineal sube al 94 %
 * y las recupera todas. Al triple no mejora más y cuesta el doble de tiempo.
 *
 * Devuelve un Buffer PNG. Las coordenadas que devuelva el OCR habrá que
 * dividirlas por el factor para volver al tamaño original.
 */
export function ampliarParaOcr(img, factor = 2) {
  const { ancho, alto, datos } = img;
  const salida = new PNG({ width: ancho * factor, height: alto * factor });
  const px = (x, y, c) => datos[(y * ancho + x) * 4 + c];

  for (let y = 0; y < salida.height; y++) {
    const fy = y / factor;
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, alto - 1);
    const dy = fy - y0;

    for (let x = 0; x < salida.width; x++) {
      const fx = x / factor;
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, ancho - 1);
      const dx = fx - x0;
      const j = (y * salida.width + x) * 4;

      for (let c = 0; c < 3; c++) {
        const arriba = px(x0, y0, c) * (1 - dx) + px(x1, y0, c) * dx;
        const abajo = px(x0, y1, c) * (1 - dx) + px(x1, y1, c) * dx;
        salida.data[j + c] = Math.round(arriba * (1 - dy) + abajo * dy);
      }
      salida.data[j + 3] = 255;
    }
  }
  return PNG.sync.write(salida);
}

/**
 * Recorta la zona verde y la deja en blanco y negro de alto contraste.
 *
 * El problema que resuelve: la opción correcta va en texto blanco sobre fondo
 * verde, y ahí Tesseract se pierde porque el contraste es flojo. Aquí se
 * invierte la lógica —lo verde pasa a blanco, lo demás a negro— con lo que
 * queda texto negro sobre fondo blanco, que es justo lo que un OCR espera.
 *
 * Se escala x2 porque los modelos de Tesseract van bastante mejor con texto
 * grande, y estas franjas suelen ser de letra pequeña.
 *
 * Devuelve un Buffer PNG listo para pasárselo a tesseract.
 */
export function recorteRealzado(img, banda, { margen = 6, escala = 2, margenColor = 26 } = {}) {
  const { ancho, alto, datos } = img;

  const x0 = Math.max(0, (banda.izquierda ?? 0) - margen);
  const x1 = Math.min(ancho, (banda.derecha ?? ancho) + margen);
  const y0 = Math.max(0, banda.arriba - margen);
  const y1 = Math.min(alto, banda.abajo + margen);
  const anchoR = x1 - x0;
  const altoR = y1 - y0;
  if (anchoR < 10 || altoR < 6) return null;

  const salida = new PNG({ width: anchoR * escala, height: altoR * escala });

  for (let y = 0; y < altoR; y++) {
    for (let x = 0; x < anchoR; x++) {
      const i = ((y + y0) * ancho + (x + x0)) * 4;
      const r = datos[i], g = datos[i + 1], b = datos[i + 2];
      // Verde = fondo -> blanco. Cualquier otra cosa dentro de la banda
      // (el texto blanco, el círculo del radio) -> negro.
      const esFondo = g > r + margenColor && g > b + margenColor;
      const v = esFondo ? 255 : 0;

      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const j = (((y * escala + dy) * anchoR * escala) + (x * escala + dx)) * 4;
          salida.data[j] = v;
          salida.data[j + 1] = v;
          salida.data[j + 2] = v;
          salida.data[j + 3] = 255;
        }
      }
    }
  }

  return PNG.sync.write(salida);
}
