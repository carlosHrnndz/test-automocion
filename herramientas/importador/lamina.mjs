// ---------------------------------------------------------------------------
// El "papel" y los útiles de dibujo.
//
// Todo esto es lo que da a las láminas su aspecto de cuaderno antiguo: el
// pergamino, la tinta sepia, el trazo tembloroso de mano alzada y la rosa de
// ejes que dice desde dónde estás mirando el vehículo.
//
// Va aparte de dibujos.mjs para que ese archivo se lea como lo que es: una
// colección de dibujos, sin el andamiaje de por medio.
// ---------------------------------------------------------------------------

// El lienzo es estrecho a propósito. En un iPhone la lámina se muestra a unos
// 340 px de ancho: con un lienzo de 640 se encogía a la mitad y la rotulación
// —que es lo que hace didáctico el dibujo— quedaba a 6 px, ilegible. Con 420
// el texto de 14 px se ve a 11 px reales, que ya se lee.
export const ANCHO = 420;

export const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Paleta -----------------------------------------------------------------
// Sepia sobre pergamino, como una lámina de cuaderno. No cambia con el tema
// oscuro de la app: un pergamino en negativo no es un pergamino, y además así
// la lámina se lee igual en el móvil de día que de noche.
export const TINTA = '#4a3728';        // trazo principal
export const TINTA_SUAVE = '#6d5638';  // trazos secundarios, sombreado y notas
export const SANGUINA = '#a44a28';     // lo importante: fuerzas, movimiento
export const PAPEL = '#f2e8d5';
export const PAPEL_SOMBRA = '#e6d8bd';

// --- Volumen ----------------------------------------------------------------
//
// Un contorno plano se lee como un plano. Para que una pieza parezca una pieza
// hace falta que la luz caiga de algún sitio: aquí, siempre desde arriba y a
// la izquierda, como en una lámina de taller.

export const LUZ = { x: -0.4, y: -0.7 };   // de dónde viene la luz

/** Los degradados y la sombra. Van una vez por lámina, en <defs>. */
export const DEFS_VOLUMEN = `
    <linearGradient id="vol-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="#c9b48c" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#6d5638" stop-opacity="0.42"/>
    </linearGradient>
    <linearGradient id="vol-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="0.4" stop-color="#c9b48c" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#6d5638" stop-opacity="0.4"/>
    </linearGradient>
    <radialGradient id="vol-r" cx="0.34" cy="0.3" r="0.78">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="0.5" stop-color="#c9b48c" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#6d5638" stop-opacity="0.45"/>
    </radialGradient>
    <filter id="difuso" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>`;

/** Volumen de cilindro: luz a la izquierda, sombra a la derecha. */
export const volumenH = (x, y, w, h, radio = 3) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radio}" fill="url(#vol-h)"/>`;

/** Volumen de superficie horizontal: luz arriba. */
export const volumenV = (x, y, w, h, radio = 3) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radio}" fill="url(#vol-v)"/>`;

/** Volumen esférico o de disco. */
export const volumenR = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#vol-r)"/>`;

/** Sombra proyectada en el suelo. */
export const sombraSuelo = (cx, y, rx, ry = 5) =>
  `<ellipse cx="${cx + rx * 0.22}" cy="${y + 3}" rx="${rx}" ry="${ry}" fill="#5a4526" opacity="0.28" filter="url(#difuso)"/>`;

// --- Útiles de dibujo -------------------------------------------------------

/** Trazo suelto. `mano` le da el temblor del pulso. */
export const linea = (x1, y1, x2, y2, { color = TINTA, ancho = 2, guion = null } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${ancho}"` +
  `${guion ? ` stroke-dasharray="${guion}"` : ''} stroke-linecap="round"/>`;

export const camino = (d, { color = TINTA, ancho = 2, relleno = 'none' } = {}) =>
  `<path d="${d}" fill="${relleno}" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const rect = (x, y, w, h, { color = TINTA, ancho = 2, relleno = 'none', radio = 3 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radio}" fill="${relleno}" stroke="${color}" stroke-width="${ancho}"/>`;

export const circulo = (cx, cy, r, { color = TINTA, ancho = 2, relleno = 'none' } = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${relleno}" stroke="${color}" stroke-width="${ancho}"/>`;

export const flecha = (x1, y1, x2, y2, { color = SANGUINA, ancho = 2.4 } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round"` +
  ` marker-end="url(#${color === SANGUINA ? 'punta' : 'punta-suave'})"/>`;

/** Flecha curva, para giros. */
export const giro = (cx, cy, r, desde, hasta, { color = SANGUINA } = {}) => {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(desde);
  const [x2, y2] = p(hasta);
  const largo = Math.abs(hasta - desde) > 180 ? 1 : 0;
  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largo} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}"
    fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" marker-end="url(#punta)"/>`;
};

/** Sombreado a rayas, como el de una lámina a plumilla. */
export const rayado = (x, y, w, h, { color = TINTA_SUAVE, paso = 7, angulo = 45 } = {}) => {
  const id = `rayado-${Math.round(x)}-${Math.round(y)}-${Math.round(angulo)}`;
  return `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${paso}" height="${paso}"
      patternTransform="rotate(${angulo})">
      <line x1="0" y1="0" x2="0" y2="${paso}" stroke="${color}" stroke-width="0.9" opacity="0.55"/>
    </pattern></defs>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`;
};

/**
 * Cota, con sus dos topes. SÓLO la línea: el texto de la medida va aparte, en
 * los `textos` de la lámina. Si el rótulo se devolviera aquí acabaría dentro
 * del filtro de mano alzada, que es para trazos, y saldría deformado.
 */
export const cota = (x1, y1, x2, y2, { color = TINTA_SUAVE } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.3"
     marker-start="url(#tope)" marker-end="url(#tope)"/>`;

/** El rótulo de una cota, para ponerlo en los textos. */
export const rotuloCota = (x1, y1, x2, y2, texto, { color = TINTA_SUAVE } = {}) =>
  rotulo((x1 + x2) / 2, (y1 + y2) / 2 - 6, texto, { tam: 13, color, cursiva: true });

/** El suelo: una línea con su rayado debajo. */
export const suelo = (x1, x2, y) =>
  linea(x1, y, x2, y, { ancho: 2.6 }) +
  Array.from({ length: Math.floor((x2 - x1) / 13) }, (_, i) =>
    linea(x1 + 4 + i * 13, y, x1 - 4 + i * 13, y + 9, { color: TINTA_SUAVE, ancho: 1.1 })
  ).join('');

/**
 * Texto. Va SIEMPRE fuera del filtro de mano alzada: deformar un trazo queda
 * bien, pero deformar una letra la hace ilegible.
 */
export const rotulo = (x, y, t, {
  tam = 14, anclaje = 'middle', color = TINTA, peso = 400, cursiva = false,
} = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anclaje}" font-size="${tam}" font-weight="${peso}"` +
  `${cursiva ? ' font-style="italic"' : ''} fill="${color}" class="mano">${esc(t)}</text>`;

/** Una nota al margen, con su llamada desde el dibujo. */
export const nota = (xDesde, yDesde, xTexto, yTexto, t, { anclaje = 'start' } = {}) =>
  linea(xDesde, yDesde, xTexto - (anclaje === 'start' ? 8 : -8), yTexto - 4,
    { color: TINTA_SUAVE, ancho: 1.1 }) +
  rotulo(xTexto, yTexto, t, { tam: 13, anclaje, color: TINTA_SUAVE, cursiva: true });

// --- La rosa de ejes --------------------------------------------------------
//
// Siempre la misma y siempre en el mismo sitio: arriba a la izquierda,
// orientada como la ve la cámara.
//
//   X  a la derecha
//   Y  hacia arriba
//   Z  saliendo del papel, hacia ti
//
// Al no cambiar nunca, se convierte en una referencia fija: miras la esquina y
// sabes cómo está orientado lo que estás viendo, sin tener que interpretarla.

export const VISTAS = {
  frontal: 'visto de frente',
  superior: 'visto desde arriba',
  lateral: 'visto de lado',
  corte: 'sección',
  detalle: null,   // un detalle suelto: no hace falta situarlo
};

/**
 * La rosa de ejes. X y Z con flecha; Z, que sale del papel hacia ti, con el
 * círculo y el punto, que es como se marca en dibujo técnico.
 */
export function rosaEjes(x, y) {
  const L = 17;
  const c = TINTA_SUAVE;

  const trazos =
    flecha(x, y, x + L, y, { color: c, ancho: 1.4 }) +
    flecha(x, y, x, y - L, { color: c, ancho: 1.4 }) +
    circulo(x, y, 4.5, { color: c, ancho: 1.2, relleno: PAPEL }) +
    circulo(x, y, 1.4, { color: c, ancho: 1.2, relleno: c });

  const textos =
    rotulo(x + L + 7, y + 4, 'X', { tam: 12, color: c, peso: 700 }) +
    rotulo(x, y - L - 5, 'Y', { tam: 12, color: c, peso: 700 }) +
    rotulo(x - 9, y + 15, 'Z', { tam: 12, anclaje: 'end', color: c, peso: 700 });

  return { trazos, textos };
}

// --- La lámina completa -----------------------------------------------------

/**
 * Monta la lámina: papel, marco, título, el dibujo y los ejes.
 *
 * `dibujo` devuelve { trazos, textos }. Los trazos pasan por el filtro que les
 * da el temblor de mano alzada; los textos, no.
 */
export function lamina({ titulo = '', pie = '', vista = 'detalle', alto, dibujo }) {
  const { trazos = '', textos = '' } = dibujo || {};
  const subtitulo = VISTAS[vista] || '';
  const conEjes = !!subtitulo;

  // El pie se parte en líneas: de una tirada se salía por los lados del papel.
  const lineasPie = partirEnLineas(pie, 58);
  const altoPie = lineasPie.length ? lineasPie.length * 17 + 12 : 0;
  // La rosa va arriba a la izquierda, en la banda del título. Ahí no estorba a
  // ningún dibujo y queda siempre en el mismo sitio, que es la gracia.
  const yDibujo = titulo ? 62 : 34;
  const H = yDibujo + alto + altoPie + (conEjes ? 22 : 0) + 12;

  const yPie = yDibujo + alto + 24;
  const rosa = conEjes ? rosaEjes(34, 36) : { trazos: '', textos: '' };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${H}" width="${ANCHO}" height="${H}" role="img" aria-label="${esc(titulo || 'Esquema')}">
  <style>
    .mano { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif; }
  </style>
  <defs>
    <filter id="pulso" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="9" result="ruido"/>
      <feDisplacementMap in="SourceGraphic" in2="ruido" scale="2.1" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="grano" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="3"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <marker id="punta" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M0 0.5 L10 5 L0 9.5 L2.5 5 z" fill="${SANGUINA}"/>
    </marker>
    <marker id="punta-suave" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M0 0.5 L10 5 L0 9.5 L2.5 5 z" fill="${TINTA_SUAVE}"/>
    </marker>
    <marker id="tope" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <line x1="5" y1="1" x2="5" y2="9" stroke="${TINTA_SUAVE}" stroke-width="1.6"/>
    </marker>${DEFS_VOLUMEN}
  </defs>

  <rect width="${ANCHO}" height="${H}" fill="${PAPEL}"/>
  <rect width="${ANCHO}" height="${H}" fill="${PAPEL}" filter="url(#grano)" opacity="0.9"/>
  <rect x="7" y="7" width="${ANCHO - 14}" height="${H - 14}" fill="none"
        stroke="${TINTA_SUAVE}" stroke-width="1" opacity="0.5" rx="2"/>
${conEjes ? `  <g filter="url(#pulso)">${rosa.trazos}</g>\n${rosa.textos}\n` : ''}${titulo ? `  ${rotulo(ANCHO / 2 + 22, 30, titulo, { tam: 17.5, peso: 600 })}
  ${linea(ANCHO / 2 - 68, 40, ANCHO / 2 + 112, 40, { color: TINTA_SUAVE, ancho: 0.9 })}\n` : ''}
  <g transform="translate(0 ${yDibujo})">
    <g filter="url(#pulso)">
${trazos}
    </g>
${textos}
  </g>
${lineasPie.map((l, i) => '  ' + rotulo(ANCHO / 2, yPie + i * 17, l, { tam: 13, cursiva: true })).join('\n')}
${conEjes ? `  ${rotulo(ANCHO / 2, H - 13, subtitulo, { tam: 12.5, color: TINTA_SUAVE, cursiva: true })}\n` : ''}</svg>
`;
}

/** Parte un texto en líneas que quepan en el ancho del papel. */
export function partirEnLineas(texto, porLinea = 58) {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if (!actual) { actual = p; continue; }
    if ((actual + ' ' + p).length <= porLinea) actual += ' ' + p;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}
