// ---------------------------------------------------------------------------
// Láminas de SISTEMAS MECÁNICOS, una por pregunta.
//
// Cada entrada está dibujada a partir de la explicación y el ejemplo de SU
// pregunta, no de un tema genérico. La clave es el identificador de la
// pregunta en el banco, que es lo que usa el panel para colocarlas.
//
// Se dibujan con los mismos útiles que el resto: papel sepia, trazo de mano
// alzada, volumen con luz de arriba a la izquierda y la rosa de ejes.
// ---------------------------------------------------------------------------

import {
  ANCHO as W, TINTA, TINTA_SUAVE, SANGUINA, PAPEL,
  linea, camino, rect, circulo, flecha, giro, rayado, cota, rotuloCota,
  suelo, rotulo, engranaje, primitiva, polea, bloque, correa,
  volumenH, volumenV, volumenR, sombraSuelo,
} from '../importador/lamina.mjs';

export const LAMINAS = {

  // «En la rotura por fatiga...» → todas las anteriores son correctas.
  // La explicación insiste en el ciclo: microgrietas que crecen hasta que la
  // sección que queda no aguanta. Se dibuja esa historia en tres tiempos.
  'cfsd-0001': {
    titulo: 'La rotura por fatiga',
    pie: 'Cargas pequeñas repetidas muchas veces. La grieta avanza en silencio y un día la sección que queda ya no aguanta.',
    vista: 'detalle',
    alto: 300,
    dibujo() {
      let trazos = '', textos = '';
      const x = 84, ancho = 122, alto = 54;
      const fases = [
        { y: 34, g: 0, t: 'Pieza sana', d: 'aguanta de sobra' },
        { y: 132, g: 24, t: 'Microgrieta', d: 'nace en un punto débil' },
        { y: 230, g: 44, t: 'La grieta avanza', d: 'un poco en cada ciclo' },
      ];
      for (const f of fases) {
        const cx = x + ancho / 2;
        trazos += bloque(x, f.y, ancho, alto, { radio: 2 });
        if (f.g) {
          trazos += camino(
            `M ${cx} ${f.y} l -6 ${f.g * 0.34} l 8 ${f.g * 0.3} l -5 ${f.g * 0.36}`,
            { color: SANGUINA, ancho: 2.6 });
          // La sección que todavía trabaja, cada vez más pequeña
          trazos += cota(x + 4, f.y + alto + 9, cx - 8, f.y + alto + 9);
          trazos += cota(cx + 8, f.y + alto + 9, x + ancho - 4, f.y + alto + 9);
        }
        trazos += flecha(x - 8, f.y + alto / 2, x - 30, f.y + alto / 2, { ancho: 2 });
        trazos += flecha(x + ancho + 8, f.y + alto / 2, x + ancho + 30, f.y + alto / 2, { ancho: 2 });
        textos += rotulo(x + ancho + 40, f.y + alto / 2 - 3, f.t, { tam: 13.5, anclaje: 'start', peso: 600 });
        textos += rotulo(x + ancho + 40, f.y + alto / 2 + 15, f.d,
          { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      }
      trazos += flecha(36, 46, 36, 268, { color: TINTA_SUAVE, ancho: 1.4 });
      textos += rotulo(26, 160, 'ciclos', { tam: 13, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  // «Se parte con carga muy inferior a la de rotura» → fatiga.
  // Lo que hay que ver aquí es la comparación: la carga que la parte está muy
  // por debajo de la que la rompería de un tirón. Eso pide una gráfica.
  'cfsd-0002': {
    titulo: 'Rompe muy por debajo de su límite',
    pie: 'La carga cíclica ni se acerca a la de rotura. Lo que la parte no es su tamaño, es su repetición.',
    vista: 'detalle',
    alto: 250,
    dibujo() {
      let trazos = '', textos = '';
      const x0 = 60, x1 = 372, yRotura = 52, yMedia = 150, amplitud = 26;

      // Eje de tiempo y de carga
      trazos += flecha(x0, 214, x1 + 12, 214, { color: TINTA_SUAVE, ancho: 1.4 });
      trazos += flecha(x0, 214, x0, 38, { color: TINTA_SUAVE, ancho: 1.4 });

      // La carga que rompería la pieza de un solo tirón
      trazos += linea(x0, yRotura, x1, yRotura, { color: SANGUINA, ancho: 1.6, guion: '7 5' });

      // La carga real: una onda muy por debajo
      let d = `M ${x0} ${yMedia}`;
      for (let i = 0; i <= 40; i++) {
        const px = x0 + ((x1 - x0) * i) / 40;
        const py = yMedia - Math.sin((i / 40) * Math.PI * 7) * amplitud;
        d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      trazos += camino(d, { ancho: 2.4 });

      // El momento en que parte, al final de la onda
      trazos += linea(x1 - 6, 108, x1 - 6, 192, { color: SANGUINA, ancho: 2.4 });
      trazos += camino(`M ${x1 - 14} 120 l 10 12 l -8 12 l 10 10`, { color: SANGUINA, ancho: 2.6 });

      // La distancia entre las dos: lo que sobra y aun así rompe
      trazos += cota(160, yRotura + 8, 160, yMedia - amplitud - 4);

      textos += rotulo(x0 + 4, yRotura - 9, 'carga que la rompería de un tirón',
        { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(172, (yRotura + yMedia - amplitud) / 2 + 4, 'nunca llega ahí',
        { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(x0 + 6, 196, 'carga real, que sube y baja',
        { tam: 13, anclaje: 'start', cursiva: true });
      textos += rotulo(x1 - 16, 104, 'parte', { tam: 13.5, anclaje: 'end', color: SANGUINA, peso: 600 });
      textos += rotulo(x1 + 6, 232, 'tiempo', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(x0 - 8, 44, 'carga', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  // «¿Unidad de fuerza en el SI?» → el newton.
  // La definición es lo que hay que ver: un kilo, acelerando un metro por
  // segundo cada segundo. Y al lado, dónde te lo encuentras: el par de apriete.
  'cfsd-0003': {
    titulo: 'Qué es un newton',
    pie: '1 N es la fuerza que a 1 kg le cambia la velocidad en 1 m/s cada segundo. En el taller lo ves como N·m.',
    vista: 'lateral',
    alto: 250,
    dibujo() {
      let trazos = '', textos = '';
      // La masa de un kilo sobre el suelo
      const yb = 128;
      trazos += sombraSuelo(96, yb, 34, 4);
      trazos += suelo(30, 200, yb);
      trazos += bloque(64, yb - 52, 64, 52);
      trazos += flecha(30, yb - 26, 58, yb - 26, { ancho: 3.2 });
      // La aceleración resultante
      trazos += flecha(136, yb - 68, 190, yb - 68, { color: TINTA_SUAVE, ancho: 2 });

      textos += rotulo(96, yb - 22, '1 kg', { tam: 14, peso: 600 });
      textos += rotulo(30, yb - 36, '1 N', { tam: 14, anclaje: 'start', color: SANGUINA, peso: 700 });
      textos += rotulo(163, yb - 76, '1 m/s²', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(115, 210, 'la fuerza', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(115, 228, 'que lo acelera', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });

      // Y la llave dinamométrica, que es donde lo usas
      const cx = 268, cy = 96;
      trazos += circulo(cx, cy, 17, { ancho: 2.4, relleno: PAPEL });
      trazos += volumenR(cx, cy, 17);
      trazos += rect(cx, cy - 6, 108, 12, { ancho: 2.2, radio: 3, relleno: PAPEL });
      trazos += volumenV(cx, cy - 6, 108, 12, 3);
      trazos += flecha(cx + 108, cy - 42, cx + 108, cy - 14, { ancho: 2.6 });
      trazos += giro(cx, cy, 28, -150, -30, { color: SANGUINA });
      trazos += cota(cx, cy + 30, cx + 108, cy + 30);

      textos += rotulo(cx + 108, cy - 48, 'N', { tam: 13.5, color: SANGUINA, peso: 700 });
      textos += rotuloCota(cx, cy + 30, cx + 108, cy + 30, 'metros');
      textos += rotulo(cx + 54, cy + 62, 'par de apriete', { tam: 13, peso: 600 });
      textos += rotulo(cx + 54, cy + 80, 'newton × metro', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      trazos += linea(226, 40, 226, 200, { color: TINTA_SUAVE, ancho: 0.9, guion: '4 5' });
      return { trazos, textos };
    },
  },

  // «Piñón y rueda que engranan: ¿velocidades lineales?» → iguales.
  // Lo que hay que ver: en el punto de contacto la velocidad es la misma, y sin
  // embargo el pequeño da más vueltas. Ésa es toda la pregunta.
  'cfsd-0004': {
    titulo: 'Dos engranajes que engranan',
    pie: 'En el punto de contacto la velocidad lineal es la misma en los dos. Lo que cambia es cuántas vueltas da cada uno.',
    vista: 'lateral',
    alto: 250,
    dibujo() {
      let trazos = '', textos = '';
      const rG = 74, rP = 40;
      const cxG = 132, cyG = 116;
      const cxP = cxG + rG + rP + 4, cyP = cyG;

      trazos += engranaje(cxG, cyG, rG, 18);
      trazos += engranaje(cxP, cyP, rP, 10);
      trazos += primitiva(cxG, cyG, rG);
      trazos += primitiva(cxP, cyP, rP);

      // El punto de contacto y la velocidad, que es la misma para los dos
      const xc = cxG + rG + 2;
      trazos += circulo(xc, cyG, 3.4, { color: SANGUINA, ancho: 1.6, relleno: SANGUINA });
      trazos += flecha(xc, cyG, xc, cyG - 44, { ancho: 3 });

      // Los giros, en sentidos opuestos
      trazos += giro(cxG, cyG, rG * 0.56, 150, 30, { color: TINTA_SUAVE });
      trazos += giro(cxP, cyP, rP * 0.56, -30, -150, { color: TINTA_SUAVE });

      textos += rotulo(xc + 8, cyG - 50, 'la misma velocidad',
        { tam: 13, anclaje: 'middle', color: SANGUINA, peso: 600 });
      textos += rotulo(xc, cyG - 34, 'aquí', { tam: 12, anclaje: 'end', color: SANGUINA, cursiva: true });
      textos += rotulo(cxG, cyG + 6, 'una vuelta', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxP, cyP + 6, 'casi dos', { tam: 12, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(W / 2, 232, 'la línea de puntos es la circunferencia primitiva',
        { tam: 12.5, color: SANGUINA, cursiva: true });
      return { trazos, textos };
    },
  },

  // «Piñón y cremallera» → sistema tangencial, dientes rectos o helicoidales.
  // Dos cosas que enseñar: que el giro se vuelve movimiento recto, y que el
  // diente puede ser de las dos formas.
  'cfsd-0005': {
    titulo: 'Piñón y cremallera',
    pie: 'El piñón empuja los dientes de la cremallera por la tangente: el giro se vuelve un movimiento recto.',
    vista: 'lateral',
    alto: 270,
    dibujo() {
      let trazos = '', textos = '';
      const cx = 150, cy = 84, r = 42;
      trazos += engranaje(cx, cy, r, 12);
      trazos += giro(cx, cy, r * 0.58, -150, -30, { color: SANGUINA });

      // La cremallera, con sus dientes
      const yC = cy + r + 12;
      trazos += rect(40, yC, 320, 20, { ancho: 2.4, radio: 2, relleno: PAPEL });
      trazos += volumenV(40, yC, 320, 20, 2);
      for (let x = 48; x < 356; x += 13) {
        trazos += camino(`M ${x} ${yC} l 4 -8 l 5 0 l 4 8`, { ancho: 1.6 });
      }
      trazos += flecha(210, yC + 40, 300, yC + 40, { ancho: 2.8 });

      textos += rotulo(cx - 56, cy - 4, 'gira', { tam: 13, anclaje: 'end', color: SANGUINA, cursiva: true });
      textos += rotulo(256, yC + 60, 'y avanza en línea recta',
        { tam: 13, color: SANGUINA, peso: 600 });

      // Los dos tipos de diente, en un recuadro aparte
      const yD = 214;
      trazos += linea(40, yD - 12, 380, yD - 12, { color: TINTA_SUAVE, ancho: 0.8 });
      for (const [x0, inclinado, t] of [[76, false, 'recto'], [250, true, 'helicoidal']]) {
        for (let i = 0; i < 5; i++) {
          const x = x0 + i * 13;
          trazos += inclinado
            ? linea(x, yD + 4, x + 10, yD + 26, { ancho: 2 })
            : linea(x + 5, yD + 4, x + 5, yD + 26, { ancho: 2 });
        }
        trazos += rect(x0 - 8, yD, 76, 30, { color: TINTA_SUAVE, ancho: 1.2, radio: 3 });
        textos += rotulo(x0 + 30, yD + 48, t, { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  // «Los motores eléctricos se basan en...» → pares de polos electromagnéticos.
  // Se dibuja el estátor con sus polos, el rotor y de dónde sale el giro.
  'cfsd-0006': {
    titulo: 'De dónde sale el giro',
    pie: 'La corriente crea polos magnéticos. Polos iguales se repelen y contrarios se atraen: de ahí nace el par.',
    vista: 'lateral',
    alto: 260,
    dibujo() {
      let trazos = '', textos = '';
      const cx = 200, cy = 124, rE = 96, rR = 44;

      // Carcasa y polos del estátor
      trazos += circulo(cx, cy, rE, { ancho: 2.8, relleno: PAPEL });
      trazos += volumenR(cx, cy, rE);
      trazos += circulo(cx, cy, rE - 30, { ancho: 1.4, color: TINTA_SUAVE });
      for (const [ang, polo] of [[-90, 'N'], [90, 'S']]) {
        const rad = (ang * Math.PI) / 180;
        const px = cx + (rE - 22) * Math.cos(rad), py = cy + (rE - 22) * Math.sin(rad);
        trazos += rect(px - 24, py - 12, 48, 24, { ancho: 2.2, relleno: PAPEL, radio: 4 });
        trazos += rayado(px - 21, py - 9, 42, 18, { paso: 5, angulo: 45 });
        textos += rotulo(px, py + 5, polo, { tam: 15, peso: 700, color: SANGUINA });
      }

      // Rotor con su bobinado
      trazos += circulo(cx, cy, rR, { ancho: 2.4, relleno: PAPEL });
      trazos += volumenR(cx, cy, rR);
      for (const a of [20, 90, 160]) {
        const rad = (a * Math.PI) / 180;
        trazos += camino(
          `M ${(cx - rR * 0.8 * Math.cos(rad)).toFixed(1)} ${(cy - rR * 0.8 * Math.sin(rad)).toFixed(1)}
           A ${rR * 0.9} ${rR * 0.9} 0 0 1 ${(cx + rR * 0.8 * Math.cos(rad)).toFixed(1)} ${(cy + rR * 0.8 * Math.sin(rad)).toFixed(1)}`,
          { color: TINTA_SUAVE, ancho: 2 });
      }
      trazos += circulo(cx, cy, 8, { ancho: 1.8, relleno: PAPEL });
      trazos += giro(cx, cy, rR + 16, -140, -30, { color: SANGUINA });

      // La corriente que entra
      trazos += flecha(36, cy, 96, cy, { ancho: 2.6 });
      textos += rotulo(38, cy - 12, 'corriente', { tam: 13, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(cx + rR + 30, cy - 24, 'y gira', { tam: 13, anclaje: 'start', color: SANGUINA, peso: 600 });
      textos += rotulo(cx, cy + 6, 'inducido', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cx, 244, 'los polos del estátor tiran del inducido',
        { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  // «Potencia = fuerza × velocidad» → verdadero.
  // El ejemplo habla de un cabrestante: se dibuja tirando de una carga, con la
  // fuerza y la velocidad marcadas, que son los dos factores de la fórmula.
  'cfsd-0007': {
    titulo: 'Potencia: fuerza por velocidad',
    pie: 'La misma fuerza, movida más deprisa, es más potencia. Por eso un cabrestante lento tira mucho con poco motor.',
    vista: 'lateral',
    alto: 250,
    dibujo() {
      let trazos = '', textos = '';
      const yb = 156;
      trazos += suelo(24, W - 24, yb);

      // El cabrestante: tambor con cable
      const cx = 78, cy = 108;
      trazos += circulo(cx, cy, 30, { ancho: 2.6, relleno: PAPEL });
      trazos += volumenR(cx, cy, 30);
      for (let i = 0; i < 4; i++) {
        trazos += circulo(cx, cy, 30 - i * 5.5, { color: TINTA_SUAVE, ancho: 1 });
      }
      trazos += giro(cx, cy, 42, 40, 160, { color: SANGUINA });

      // El cable tirando de la carga
      trazos += linea(cx + 30, cy - 6, 268, cy - 6, { ancho: 2.6 });
      trazos += sombraSuelo(310, yb, 40, 4);
      trazos += bloque(268, cy - 34, 84, 56);

      // Fuerza en el cable y velocidad de la carga
      trazos += flecha(210, cy - 6, 152, cy - 6, { ancho: 3.2 });
      trazos += flecha(268, yb + 22, 200, yb + 22, { color: TINTA_SUAVE, ancho: 2.2 });

      textos += rotulo(180, cy - 16, 'F', { tam: 15, color: SANGUINA, peso: 700 });
      textos += rotulo(232, yb + 18, 'v', { tam: 14, color: TINTA_SUAVE, peso: 700 });
      textos += rotulo(310, cy - 2, 'carga', { tam: 13, peso: 600 });
      textos += rotulo(cx, cy + 52, 'cabrestante', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(W / 2, 226, 'P = F × v', { tam: 17, peso: 700, color: SANGUINA });
      return { trazos, textos };
    },
  },

  // «¿Qué correa lleva la distribución?» → dentada.
  // Lo que hay que ver: por qué dentada y no lisa. El diente impide que resbale,
  // y de eso depende que cigüeñal y árbol de levas no se descoloquen.
  'cfsd-0008': {
    titulo: 'La correa de distribución',
    pie: 'Es dentada porque no puede resbalar ni un diente: de esa sincronía dependen las válvulas y los pistones.',
    vista: 'lateral',
    alto: 280,
    dibujo() {
      let trazos = '', textos = '';
      const cxA = 118, cyA = 88, rA = 52;    // árbol de levas, arriba
      const cxB = 118, cyB = 214, rB = 34;   // cigüeñal, abajo
      const cxT = 250, cyT = 150, rT = 22;   // tensor

      trazos += engranaje(cxA, cyA, rA, 20);
      trazos += engranaje(cxB, cyB, rB, 13);
      trazos += polea(cxT, cyT, rT);

      // La correa, rodeando las dos poleas
      trazos += correa(
        `M ${cxA - rA - 4} ${cyA} A ${rA + 4} ${rA + 4} 0 1 1 ${cxA + rA + 4} ${cyA}
         Q ${cxT + rT + 6} ${cyT - 30} ${cxT + rT + 4} ${cyT}
         Q ${cxT + rT + 6} ${cyT + 30} ${cxB + rB + 4} ${cyB}
         A ${rB + 4} ${rB + 4} 0 1 1 ${cxB - rB - 4} ${cyB}
         L ${cxA - rA - 4} ${cyA}`, { dentada: true });

      trazos += giro(cxA, cyA, rA * 0.5, -150, -30, { color: SANGUINA });
      trazos += giro(cxB, cyB, rB * 0.5, -150, -30, { color: SANGUINA });

      textos += rotulo(cxA + rA + 40, cyA - 14, 'árbol de levas', { tam: 13, anclaje: 'start', peso: 600 });
      textos += rotulo(cxA + rA + 40, cyA + 4, 'abre las válvulas',
        { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxB + rB + 46, cyB - 14, 'cigüeñal', { tam: 13, anclaje: 'start', peso: 600 });
      textos += rotulo(cxB + rB + 46, cyB + 4, 'mueve los pistones',
        { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxT + 34, cyT + 4, 'tensor', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(40, 152, 'dientes:', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(40, 170, 'no resbala', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      return { trazos, textos };
    },
  },

  // «Trenes epicicloidales» → cambios automáticos y reductoras de arranque.
  // Aquí lo que hace falta es reconocer las cuatro piezas y ver que los
  // satélites giran sobre sí mismos Y alrededor del sol.
  'cfsd-0009': {
    titulo: 'El tren epicicloidal',
    pie: 'Los satélites giran sobre sí mismos y a la vez alrededor del sol. Frenando una pieza u otra salen distintas relaciones.',
    vista: 'lateral',
    alto: 290,
    dibujo() {
      let trazos = '', textos = '';
      const cx = 190, cy = 140;
      const rCorona = 122, rSol = 40, rSat = 34;

      // Corona: dientes hacia dentro
      trazos += circulo(cx, cy, rCorona, { ancho: 2.8, relleno: PAPEL });
      trazos += volumenR(cx, cy, rCorona);
      trazos += circulo(cx, cy, rCorona - 12, { ancho: 2, color: TINTA });
      for (let a = 0; a < 360; a += 12) {
        const rad = (a * Math.PI) / 180;
        trazos += linea(
          cx + (rCorona - 12) * Math.cos(rad), cy + (rCorona - 12) * Math.sin(rad),
          cx + (rCorona - 20) * Math.cos(rad), cy + (rCorona - 20) * Math.sin(rad),
          { color: TINTA_SUAVE, ancho: 1.4 });
      }

      // Sol en el centro y tres satélites alrededor
      trazos += engranaje(cx, cy, rSol, 12);
      const centros = [];
      for (const a of [-90, 30, 150]) {
        const rad = (a * Math.PI) / 180;
        const sx = cx + (rSol + rSat + 2) * Math.cos(rad);
        const sy = cy + (rSol + rSat + 2) * Math.sin(rad);
        centros.push([sx, sy]);
        trazos += engranaje(sx, sy, rSat, 10);
        trazos += giro(sx, sy, rSat * 0.55, -150, -20, { color: SANGUINA });
      }
      // El portasatélites, uniendo los tres centros
      trazos += camino(
        `M ${centros[0][0].toFixed(1)} ${centros[0][1].toFixed(1)}
         L ${centros[1][0].toFixed(1)} ${centros[1][1].toFixed(1)}
         L ${centros[2][0].toFixed(1)} ${centros[2][1].toFixed(1)} Z`,
        { color: TINTA_SUAVE, ancho: 3 });
      trazos += giro(cx, cy, rSol + rSat + 22, 60, 170, { color: SANGUINA });

      textos += rotulo(cx, cy + 5, 'sol', { tam: 13, peso: 600 });
      textos += rotulo(centros[1][0], centros[1][1] + 5, 'satélite', { tam: 11.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cx, cy - rCorona + 26, 'corona', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cx - 4, cy + 62, 'portasatélites', { tam: 11.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cx, 282, 'caja automática y reductora del motor de arranque',
        { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  // «El polipasto» → multiplica la fuerza pero no la potencia.
  // La clave del enunciado es el "pero no la potencia": tiras con la mitad de
  // fuerza, sí, pero recoges el doble de cable. Hay que ver las dos cosas.
  'cfsd-0010': {
    titulo: 'El polipasto',
    pie: 'Tiras con la mitad de fuerza, pero recoges el doble de cable. La potencia que pones es la misma.',
    vista: 'lateral',
    alto: 300,
    dibujo() {
      let trazos = '', textos = '';
      const yTecho = 40;
      // Techo del taller
      trazos += linea(50, yTecho, 340, yTecho, { ancho: 3 });
      trazos += rayado(50, yTecho - 12, 290, 12, { paso: 7, angulo: 45 });

      const cxF = 140, cyF = yTecho + 30;    // polea fija
      const cxM = 226, cyM = 168;            // polea móvil
      trazos += linea(cxF, yTecho, cxF, cyF - 22, { ancho: 2.4 });
      trazos += polea(cxF, cyF, 22);
      trazos += polea(cxM, cyM, 22);

      // El cable: baja, rodea la móvil, sube y baja al extremo donde tiras
      trazos += camino(`M ${cxF - 22} ${cyF} L ${cxF - 22} 250`, { ancho: 2.4 });
      trazos += camino(`M ${cxF + 22} ${cyF} L ${cxM - 22} ${cyM}`, { ancho: 2.4 });
      trazos += camino(`M ${cxM + 22} ${cyM} L ${cxM + 22} ${yTecho}`, { ancho: 2.4 });

      // La carga colgando de la polea móvil
      trazos += linea(cxM, cyM + 22, cxM, cyM + 46, { ancho: 2.4 });
      trazos += bloque(cxM - 44, cyM + 46, 88, 58);

      // Fuerza que haces y recorrido de cable
      trazos += flecha(cxF - 22, 216, cxF - 22, 258, { ancho: 3 });
      trazos += cota(cxF - 60, 168, cxF - 60, 250);
      trazos += flecha(cxM + 58, cyM + 30, cxM + 58, cyM - 6, { color: TINTA_SUAVE, ancho: 2.2 });
      trazos += cota(cxM + 76, cyM - 6, cxM + 76, cyM + 30);

      textos += rotulo(cxF - 16, 274, 'tiras con la mitad',
        { tam: 13, anclaje: 'start', color: SANGUINA, peso: 600 });
      textos += rotulo(cxF - 68, 200, 'el doble', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxF - 68, 218, 'de cable', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxM, cyM + 82, 'carga', { tam: 13.5, peso: 600 });
      textos += rotuloCota(cxM + 84, cyM - 6, cxM + 84, cyM + 30, 'sube');
      textos += rotulo(cxM + 90, cyM + 26, 'la mitad', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxF, cyF - 32, 'polea fija', { tam: 12, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cxM - 30, cyM - 30, 'polea móvil', { tam: 12, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },
};
