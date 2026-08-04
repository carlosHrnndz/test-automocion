// ---------------------------------------------------------------------------
// Persistencia local (localStorage). Todo el progreso vive en el navegador:
// no hay servidor, no hay cuentas, no se envía nada a ninguna parte.
// ---------------------------------------------------------------------------

const P = 'ta_'; // prefijo

function leer(clave, porDefecto) {
  try {
    const bruto = localStorage.getItem(P + clave);
    return bruto === null ? porDefecto : JSON.parse(bruto);
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(P + clave, JSON.stringify(valor));
  } catch (e) {
    console.warn('No se pudo guardar', clave, e);
  }
}

// --- Estadísticas por pregunta -------------------------------------------
// { [idPregunta]: { a: aciertos, f: fallos, r: racha de aciertos, t: timestamp } }

export const estadisticas = {
  todas: () => leer('stats', {}),
  de(id) {
    return this.todas()[id] || { a: 0, f: 0, r: 0, t: 0 };
  },
  registrar(id, acertada) {
    const stats = this.todas();
    const e = stats[id] || { a: 0, f: 0, r: 0, t: 0 };
    if (acertada) {
      e.a += 1;
      e.r += 1;
    } else {
      e.f += 1;
      e.r = 0;
    }
    e.t = Date.now();
    stats[id] = e;
    escribir('stats', stats);
    return e;
  },
  reiniciar() {
    escribir('stats', {});
  },
};

/**
 * Una pregunta entra en "repaso" si alguna vez la fallaste y todavía no la has
 * acertado 2 veces seguidas. Es repetición espaciada sencilla: los fallos
 * salen del listado sólo cuando demuestras que la dominas.
 */
export function necesitaRepaso(e) {
  return e && e.f > 0 && e.r < 2;
}

/** "Fallo frecuente" = fallada 2 o más veces. */
export function esFalloFrecuente(e) {
  return e && e.f >= 2;
}

// --- Preguntas marcadas para después --------------------------------------

export const marcadas = {
  todas: () => leer('marcadas', []),
  tiene(id) {
    return this.todas().includes(id);
  },
  alternar(id) {
    const lista = this.todas();
    const i = lista.indexOf(id);
    if (i === -1) lista.push(id);
    else lista.splice(i, 1);
    escribir('marcadas', lista);
    return i === -1;
  },
  limpiar() {
    escribir('marcadas', []);
  },
};

// --- Historial de tests ----------------------------------------------------

export const historial = {
  todo: () => leer('historial', []),
  añadir(entrada) {
    const h = this.todo();
    h.unshift(entrada);
    escribir('historial', h.slice(0, 200));
  },
  limpiar() {
    escribir('historial', []);
  },
};

// --- Sesión en curso (para poder reanudar) ---------------------------------

export const sesion = {
  leer: () => leer('sesion', null),
  guardar: (s) => escribir('sesion', s),
  borrar: () => escribir('sesion', null),
};

// --- Ajustes ---------------------------------------------------------------

const AJUSTES_POR_DEFECTO = {
  tema: 'oscuro',
  avanceAutomatico: false,
  barajarOpciones: true,
  sonido: false,
};

export const ajustes = {
  leer: () => ({ ...AJUSTES_POR_DEFECTO, ...leer('ajustes', {}) }),
  guardar(parcial) {
    const nuevos = { ...this.leer(), ...parcial };
    escribir('ajustes', nuevos);
    return nuevos;
  },
};

// --- Copia de seguridad ----------------------------------------------------

export function exportarProgreso() {
  return {
    version: 1,
    exportado: new Date().toISOString(),
    stats: estadisticas.todas(),
    marcadas: marcadas.todas(),
    historial: historial.todo(),
    ajustes: ajustes.leer(),
  };
}

export function importarProgreso(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('Archivo no válido');
  if (datos.stats) escribir('stats', datos.stats);
  if (datos.marcadas) escribir('marcadas', datos.marcadas);
  if (datos.historial) escribir('historial', datos.historial);
  if (datos.ajustes) escribir('ajustes', datos.ajustes);
}
