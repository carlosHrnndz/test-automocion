// ---------------------------------------------------------------------------
// Puente con el lector de texto de macOS.
//
// macOS lleva dentro un OCR excelente (el framework Vision) que es el que hace
// que en Vista Previa puedas seleccionar el texto de una imagen. Para capturas
// de pantalla es bastante mejor que Tesseract, va en décimas de segundo y no
// hay que instalar nada: ya está en el sistema.
//
// La única pega es que hay que hablar con él desde Swift, así que este módulo
// compila un pequeño programa la primera vez y luego lo reutiliza.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUENTE = path.join(AQUI, 'ocr-macos.swift');
const BINARIO = path.join(AQUI, '.bin', 'ocr-macos');

/** ¿Se puede usar el lector de macOS en este equipo? */
export function comprobarMacOS() {
  if (os.platform() !== 'darwin') {
    return { ok: false, motivo: 'El lector de macOS sólo existe en Mac.' };
  }
  if (!fs.existsSync(FUENTE)) {
    return { ok: false, motivo: 'Falta ocr-macos.swift.' };
  }
  try {
    execFileSync('swiftc', ['--version'], { stdio: 'ignore' });
  } catch {
    return {
      ok: false,
      motivo: 'Faltan las herramientas de desarrollo de Apple. En el Terminal:\n' +
              '  xcode-select --install\n' +
              'Es una descarga de Apple, tarda unos minutos y sólo se hace una vez.',
    };
  }
  return { ok: true };
}

/**
 * Compila el programa si hace falta. Se recompila solo si el .swift ha cambiado.
 * Devuelve la ruta del binario.
 */
export function prepararMacOS() {
  const estado = comprobarMacOS();
  if (!estado.ok) throw new Error(estado.motivo);

  const hayBinario = fs.existsSync(BINARIO);
  const alDia = hayBinario &&
    fs.statSync(BINARIO).mtimeMs >= fs.statSync(FUENTE).mtimeMs;
  if (alDia) return BINARIO;

  fs.mkdirSync(path.dirname(BINARIO), { recursive: true });
  try {
    execFileSync('swiftc', ['-O', '-o', BINARIO, FUENTE], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 120000,
    });
  } catch (e) {
    const detalle = String(e.stderr || e.message).slice(0, 400);
    throw new Error('No se ha podido preparar el lector de macOS:\n' + detalle);
  }
  return BINARIO;
}

// La primera lectura carga los modelos de macOS y tarda mucho más.
let primeraVez = true;

function mensajeDeFallo(e) {
  if (e.code === 'ETIMEDOUT') {
    return 'El lector de macOS ha tardado demasiado. Suele pasar cuando el Mac ' +
           'anda justo de memoria: cierra Ollama y otras aplicaciones y repite.';
  }
  const detalle = String(e.stderr || e.message).trim().slice(0, 200);
  return 'El lector de macOS ha fallado: ' + detalle;
}

/**
 * Convierte la respuesta del programa Swift en la lista de líneas que usa el
 * resto del importador. Aparte para poder probarla sin un Mac delante.
 */
export function lineasDesdeJson(datos) {
  // Ojo con Number(null), que vale 0 y se colaría como coordenada válida.
  const num = (v) => (typeof v === 'number' ? v : NaN);
  return (datos?.lineas || [])
    .map((l) => ({
      texto: String(l.texto || '').trim(),
      arriba: num(l.arriba),
      abajo: num(l.abajo),
      izquierda: num(l.izquierda),
      derecha: num(l.derecha),
      conf: Number.isFinite(num(l.conf)) ? num(l.conf) : 0,
    }))
    .filter((l) => l.texto
      && Number.isFinite(l.arriba) && Number.isFinite(l.abajo)
      && Number.isFinite(l.izquierda) && Number.isFinite(l.derecha))
    .sort((a, b) => a.arriba - b.arriba || a.izquierda - b.izquierda);
}

/**
 * Pasa la caja de Vision (normalizada de 0 a 1 y con el origen ABAJO a la
 * izquierda) a píxeles con el origen ARRIBA a la izquierda, que es como
 * trabaja el resto del importador. Espejo en JavaScript de lo que hace el
 * programa Swift, para poder comprobar la fórmula desde las pruebas.
 */
export function aPixeles(caja, ancho, alto) {
  return {
    izquierda: Math.round(caja.minX * ancho),
    derecha: Math.round(caja.maxX * ancho),
    arriba: Math.round((1 - caja.maxY) * alto),
    abajo: Math.round((1 - caja.minY) * alto),
  };
}

/**
 * Lee una imagen con Vision.
 * Devuelve las líneas con la misma forma que el camino de Tesseract, para que
 * sean intercambiables: [{ texto, arriba, abajo, izquierda, derecha, conf }].
 */
export function ocrLineasMacOS(rutaImagen) {
  const binario = prepararMacOS();

  // La PRIMERA lectura de la sesión es mucho más lenta que las demás: macOS
  // tiene que cargar en memoria los modelos de reconocimiento. En un Mac con
  // poca RAM, y más si Ollama está abierto ocupándola, puede tardar minutos.
  // Las siguientes van en décimas de segundo. Por eso el margen es tan amplio.
  const espera = primeraVez ? 300000 : 60000;

  const leer = () => execFileSync(binario, [rutaImagen], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: espera,
  });

  let salida;
  try {
    salida = leer();
  } catch (e) {
    // Si se ha agotado el tiempo, se da una segunda oportunidad: lo más
    // probable es que la primera llamada dejara ya los modelos cargados.
    if (e.code === 'ETIMEDOUT' && primeraVez) {
      primeraVez = false;
      try {
        salida = leer();
      } catch (e2) {
        throw new Error(mensajeDeFallo(e2));
      }
    } else {
      throw new Error(mensajeDeFallo(e));
    }
  }
  primeraVez = false;

  let datos;
  try {
    datos = JSON.parse(salida);
  } catch {
    throw new Error('El lector de macOS ha devuelto algo que no se entiende');
  }

  return lineasDesdeJson(datos);
}
