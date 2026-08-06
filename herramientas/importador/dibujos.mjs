// ---------------------------------------------------------------------------
// Catálogo de láminas.
//
// Ilustraciones de verdad —una rueda inclinada, un muelle comprimiéndose, un
// pistón empujando aceite— con el aspecto de una lámina de cuaderno: sepia
// sobre pergamino, trazo de mano alzada, volumen dado con luz y sombra, y la
// rosa de ejes en la esquina.
//
// Tres reglas que se aprendieron a base de mirarlas:
//
// 1. Se componen para el MÓVIL. Lienzo estrecho y letra grande; lo pensado
//    para monitor, en un teléfono, queda a seis píxeles y no se lee.
// 2. Nada de texto en la franja de arriba: ahí va el título y se pisan.
// 3. La luz viene siempre de arriba a la izquierda. Un contorno sin sombra se
//    lee como un plano; con ella, como una pieza.
//
// El modelo NO dibuja: sólo dice cuál de éstas toca.
// ---------------------------------------------------------------------------

import {
  ANCHO as W, TINTA, TINTA_SUAVE, SANGUINA, PAPEL,
  linea, camino, rect, circulo, flecha, giro, rayado, cota, rotuloCota, suelo, rotulo, lamina,
  volumenH, volumenV, volumenR, sombraSuelo,
} from './lamina.mjs';

/** Una rueda vista de frente, con su volumen, inclinada los grados que se pidan. */
function ruedaFrontal(cx, ySuelo, alto, grados) {
  const ancho = alto * 0.36;
  const cy = ySuelo - alto / 2;
  const x = cx - ancho / 2, y = cy - alto / 2;
  return `<g transform="rotate(${grados} ${cx} ${ySuelo})">` +
    rect(x, y, ancho, alto, { ancho: 2.2, radio: 7, relleno: PAPEL }) +
    volumenH(x, y, ancho, alto, 7) +
    // Dibujo del flanco
    rayado(x + 2.5, y + 2.5, ancho - 5, alto - 5, { paso: 9, angulo: 22 }) +
    // Llanta
    circulo(cx, cy, alto * 0.15, { ancho: 1.8, relleno: PAPEL }) +
    volumenR(cx, cy, alto * 0.15) +
    circulo(cx, cy, alto * 0.05, { ancho: 1.2 }) +
    '</g>';
}

export const CATALOGO = {
  'rueda-caida': {
    que: 'El ángulo de caída (camber): la rueda inclinada hacia dentro o hacia fuera, vista de frente.',
    titulo: 'El ángulo de caída',
    pie: 'Se mide entre el plano de la rueda y la vertical. La línea de puntos es la vertical.',
    vista: 'frontal',
    alto: 220,
    dibujo() {
      const ySuelo = 150, alto = 108;
      const casos = [
        { cx: 76, g: 10, t: 'Positiva', d: 'arriba, hacia fuera' },
        { cx: 208, g: 0, t: 'Cero', d: 'a plomo' },
        { cx: 340, g: -10, t: 'Negativa', d: 'arriba, hacia dentro' },
      ];
      let trazos = suelo(20, W - 20, ySuelo);
      let textos = '';
      for (const c of casos) {
        trazos += sombraSuelo(c.cx, ySuelo, alto * 0.24, 4);
        trazos += linea(c.cx, ySuelo - alto - 18, c.cx, ySuelo + 3,
          { color: TINTA_SUAVE, ancho: 1.2, guion: '5 5' });
        trazos += ruedaFrontal(c.cx, ySuelo, alto, c.g);
        if (c.g !== 0) trazos += giro(c.cx, ySuelo, alto + 5, -90, -90 + c.g * 1.5, { color: SANGUINA });
        textos += rotulo(c.cx, ySuelo + 34, c.t, { tam: 14.5, peso: 600 });
        textos += rotulo(c.cx, ySuelo + 52, c.d, { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  'rueda-convergencia': {
    que: 'La convergencia o divergencia (toe): las ruedas apuntando hacia dentro o hacia fuera, vistas desde arriba.',
    titulo: 'Convergencia y divergencia',
    pie: 'Se compara la separación de delante con la de detrás.',
    vista: 'superior',
    alto: 350,
    dibujo() {
      let trazos = '', textos = '';
      const casos = [
        { y: 46, g: 7, t: 'Convergencia', d: 'cierran por delante' },
        { y: 216, g: -7, t: 'Divergencia', d: 'abren por delante' },
      ];
      for (const c of casos) {
        const cx = 150, largo = 84, sep = 48;
        const yEje = c.y + largo / 2;
        trazos += linea(cx - sep, yEje, cx + sep, yEje, { color: TINTA_SUAVE, ancho: 1.8 });
        trazos += flecha(cx, c.y + 10, cx, c.y - 22, { ancho: 2.2 });
        textos += rotulo(cx + 22, c.y - 18, 'marcha', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });

        for (const lado of [-1, 1]) {
          const x = cx + lado * sep;
          trazos += linea(x, c.y - 8, x, c.y + largo + 10, { color: TINTA_SUAVE, ancho: 1.1, guion: '4 4' });
          trazos += `<g transform="rotate(${-c.g * lado} ${x} ${yEje})">` +
            rect(x - 9, c.y, 18, largo, { ancho: 2.2, radio: 4, relleno: PAPEL }) +
            volumenH(x - 9, c.y, 18, largo, 4) +
            rayado(x - 7, c.y + 2.5, 14, largo - 5, { paso: 7, angulo: 70 }) +
            '</g>';
        }
        const delta = Math.sin((c.g * Math.PI) / 180) * (largo / 2);
        trazos += cota(cx - sep + delta, c.y + 8, cx + sep - delta, c.y + 8);
        trazos += cota(cx - sep - delta, c.y + largo - 8, cx + sep + delta, c.y + largo - 8);
        textos += rotulo(cx, c.y + 2, c.g > 0 ? 'menos' : 'más',
          { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
        textos += rotulo(cx, c.y + largo + 26, c.g > 0 ? 'más' : 'menos',
          { tam: 12.5, color: TINTA_SUAVE, cursiva: true });

        textos += rotulo(240, yEje - 4, c.t, { tam: 14.5, peso: 600, anclaje: 'start' });
        textos += rotulo(240, yEje + 16, c.d, { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  'muelle-suspension': {
    que: 'El muelle de la suspensión: se comprime al recibir carga y guarda esa energía para devolverla.',
    titulo: 'El muelle de la suspensión',
    pie: 'El muelle guarda la energía y la devuelve. De frenarla se encarga el amortiguador.',
    vista: 'frontal',
    alto: 268,
    dibujo() {
      let trazos = '', textos = '';
      const casos = [
        { cx: 112, comprimido: false, t: 'En reposo', d: 'longitud libre' },
        { cx: 296, comprimido: true, t: 'Con carga', d: 'más corto' },
      ];
      for (const c of casos) {
        const yTecho = 92, yBase = 208;
        const largo = c.comprimido ? 82 : 116;
        const yFin = yTecho + largo;

        // Carrocería, con su volumen
        trazos += rect(c.cx - 46, yTecho - 22, 92, 20, { ancho: 2.2, relleno: PAPEL });
        trazos += volumenV(c.cx - 46, yTecho - 22, 92, 20);
        trazos += rayado(c.cx - 43, yTecho - 19, 86, 14, { paso: 6, angulo: 45 });

        // El muelle: cada vuelta con su sombra, para que se vea la hélice
        const vueltas = 6;
        const paso = largo / vueltas;
        let d = `M ${c.cx} ${yTecho}`;
        for (let i = 0; i < vueltas; i++) {
          d += ` L ${c.cx + 22} ${yTecho + paso * (i + 0.25)}`;
          d += ` L ${c.cx - 22} ${yTecho + paso * (i + 0.75)}`;
        }
        d += ` L ${c.cx} ${yFin}`;
        trazos += camino(d, { color: TINTA_SUAVE, ancho: 4.6 });   // sombra del alambre
        trazos += camino(d, { ancho: 2.6 });

        trazos += linea(c.cx - 28, yFin, c.cx + 28, yFin, { ancho: 2.4 });
        trazos += linea(c.cx, yFin, c.cx, yBase, { ancho: 2.4 });
        trazos += sombraSuelo(c.cx, yBase, 30, 4);
        trazos += suelo(c.cx - 54, c.cx + 54, yBase);
        trazos += cota(c.cx + 42, yTecho, c.cx + 42, yFin);

        if (c.comprimido) {
          trazos += flecha(c.cx, yTecho - 62, c.cx, yTecho - 28, { ancho: 3.2 });
          textos += rotulo(c.cx + 20, yTecho - 48, 'carga',
            { tam: 13.5, anclaje: 'start', color: SANGUINA, peso: 600 });
        }
        textos += rotulo(c.cx, yBase + 34, c.t, { tam: 14.5, peso: 600 });
        textos += rotulo(c.cx, yBase + 52, c.d, { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      }
      trazos += linea(158, 208, 250, 208, { color: TINTA_SUAVE, ancho: 1, guion: '3 4' });
      return { trazos, textos };
    },
  },

  'amortiguador': {
    que: 'El amortiguador: frena las oscilaciones del muelle obligando al aceite a pasar por orificios estrechos.',
    titulo: 'El amortiguador por dentro',
    pie: 'El aceite tarda en pasar por los orificios: ese retardo frena el rebote.',
    vista: 'corte',
    alto: 300,
    dibujo() {
      const cx = 128, yA = 76, yB = 282;
      // Cuerpo, con volumen de cilindro
      let trazos = rect(cx - 40, yA, 80, yB - yA, { ancho: 2.6, radio: 9, relleno: PAPEL });
      trazos += volumenH(cx - 40, yA, 80, yB - yA, 9);
      // Aceite
      trazos += rayado(cx - 36, yA + 70, 72, yB - yA - 74, { paso: 8, angulo: 0 });
      // Vástago, con brillo
      trazos += linea(cx, yA - 26, cx, yA + 62, { ancho: 7 });
      trazos += linea(cx - 1.6, yA - 26, cx - 1.6, yA + 62, { color: '#d9c9a6', ancho: 1.6 });
      // Pistón
      trazos += rect(cx - 34, yA + 60, 68, 15, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(cx - 34, yA + 60, 68, 15);
      for (const dx of [-19, 0, 19]) {
        trazos += rect(cx + dx - 3.5, yA + 60, 7, 15, { ancho: 1.3, relleno: PAPEL, radio: 1 });
      }
      trazos += flecha(cx, yA - 52, cx, yA - 32, { ancho: 3 });
      trazos += flecha(cx - 25, yA + 128, cx - 25, yA + 86, { ancho: 2 });
      trazos += flecha(cx + 25, yA + 128, cx + 25, yA + 86, { ancho: 2 });

      // El rótulo del empuje, al lado y no encima: arriba está el título.
      let textos = rotulo(cx + 18, yA - 40, 'el muelle empuja',
        { tam: 13, anclaje: 'start', color: SANGUINA, peso: 600 });
      const notas = [
        [yA + 16, 'vástago'],
        [yA + 68, 'pistón con orificios'],
        [yA + 112, 'el aceite pasa a la fuerza'],
        [yA + 172, 'aceite'],
      ];
      for (const [y, t] of notas) {
        trazos += linea(cx + 44, y, cx + 72, y, { color: TINTA_SUAVE, ancho: 1.1 });
        textos += rotulo(cx + 78, y + 5, t, { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  'circuito-hidraulico': {
    que: 'El principio del circuito hidráulico: la presión es igual en todo el líquido, así que una fuerza pequeña mueve una grande.',
    titulo: 'Por qué el freno multiplica la fuerza',
    pie: 'Misma presión en todo el líquido: a más superficie, más fuerza.',
    vista: 'corte',
    alto: 262,
    dibujo() {
      const yBase = 210;
      let trazos = '';
      // Cilindros y conducto, con volumen
      const piezas = [[52, 118, 44, yBase - 118], [276, 80, 106, yBase - 80], [96, yBase - 28, 180, 28]];
      for (const [x, y, w, h] of piezas) {
        trazos += rect(x, y, w, h, { ancho: 2.4, relleno: PAPEL });
        trazos += volumenH(x, y, w, h);
      }
      // Líquido
      trazos += rayado(56, 134, 36, yBase - 138, { paso: 7, angulo: 0 });
      trazos += rayado(100, yBase - 24, 172, 20, { paso: 7, angulo: 0 });
      trazos += rayado(280, 98, 98, yBase - 102, { paso: 7, angulo: 0 });
      // Pistones
      trazos += rect(52, 118, 44, 12, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(52, 118, 44, 12);
      trazos += linea(74, 84, 74, 118, { ancho: 5 });
      trazos += rect(276, 80, 106, 12, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(276, 80, 106, 12);
      trazos += linea(329, 48, 329, 80, { ancho: 5 });
      // El grosor de la flecha cuenta la historia
      trazos += flecha(74, 52, 74, 78, { ancho: 2.2 });
      trazos += flecha(329, 78, 329, 42, { ancho: 5 });
      trazos += cota(52, yBase + 14, 96, yBase + 14);
      trazos += cota(276, yBase + 14, 382, yBase + 14);

      // Los rótulos de las fuerzas, a un lado de su flecha.
      let textos = rotulo(94, 60, 'poca fuerza', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(329, 34, 'mucha fuerza', { tam: 14, color: SANGUINA, peso: 600 });
      textos += rotulo(74, yBase + 40, 'poca superficie', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(329, yBase + 40, 'mucha superficie', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(186, yBase - 6, 'la misma presión', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'par-apriete': {
    que: 'El par: fuerza por distancia. Con más brazo se consigue más par con la misma fuerza.',
    titulo: 'Qué es el par',
    pie: 'Par = fuerza × brazo. Por eso una llave larga aprieta más.',
    vista: 'detalle',
    alto: 254,
    dibujo() {
      let trazos = '', textos = '';
      const casos = [
        { cy: 78, largo: 82, t: 'Brazo corto · poco par' },
        { cy: 188, largo: 190, t: 'Brazo largo · mucho par, la misma fuerza' },
      ];
      const cx = 66;
      for (const c of casos) {
        // Tornillo con volumen
        trazos += circulo(cx, c.cy, 19, { ancho: 2.4, relleno: PAPEL });
        trazos += volumenR(cx, c.cy, 19);
        trazos += camino(
          `M ${cx - 10} ${c.cy - 5.5} L ${cx + 10} ${c.cy - 5.5} M ${cx - 10} ${c.cy + 5.5} L ${cx + 10} ${c.cy + 5.5}`,
          { color: TINTA_SUAVE, ancho: 1.6 });
        // Llave
        trazos += rect(cx, c.cy - 7, c.largo, 14, { ancho: 2.2, radio: 4, relleno: PAPEL });
        trazos += volumenV(cx, c.cy - 7, c.largo, 14, 4);
        const xf = cx + c.largo;
        trazos += flecha(xf, c.cy - 44, xf, c.cy - 14, { ancho: 2.8 });
        trazos += giro(cx, c.cy, 30, -155, -25, { color: SANGUINA });
        trazos += cota(cx, c.cy + 36, xf, c.cy + 36);
        textos += rotuloCota(cx, c.cy + 36, xf, c.cy + 36, 'brazo');
        textos += rotulo(xf + 10, c.cy - 34, 'F', { tam: 15, anclaje: 'start', color: SANGUINA, peso: 700 });
        textos += rotulo(cx, c.cy + 62, c.t, { tam: 13, peso: 600, anclaje: 'start' });
      }
      return { trazos, textos };
    },
  },

  'fatiga-rotura': {
    que: 'La rotura por fatiga: con esfuerzos repetidos aparece una grieta que crece hasta que la pieza rompe de golpe.',
    titulo: 'La rotura por fatiga',
    pie: 'Cargas pequeñas repetidas muchas veces. Al final parte de golpe, sin avisar.',
    vista: 'detalle',
    alto: 296,
    dibujo() {
      let trazos = '', textos = '';
      const x = 84, ancho = 118, alto = 54;
      const fases = [
        { y: 34, grieta: 0, t: 'Pieza sana', d: 'aguanta de sobra' },
        { y: 132, grieta: 22, t: 'Nace la grieta', d: 'en un punto débil' },
        { y: 230, grieta: 44, t: 'La grieta avanza', d: 'un poco en cada ciclo' },
      ];
      for (const f of fases) {
        const cx = x + ancho / 2;
        trazos += rect(x, f.y, ancho, alto, { ancho: 2.4, radio: 2, relleno: PAPEL });
        trazos += volumenV(x, f.y, ancho, alto, 2);
        trazos += rayado(x + 3, f.y + 3, ancho - 6, alto - 6, { paso: 8, angulo: 45 });
        if (f.grieta) {
          trazos += camino(
            `M ${cx} ${f.y} l -6 ${f.grieta * 0.34} l 8 ${f.grieta * 0.3} l -5 ${f.grieta * 0.36}`,
            { color: SANGUINA, ancho: 2.6 });
        }
        trazos += flecha(x - 8, f.y + alto / 2, x - 30, f.y + alto / 2, { ancho: 2 });
        trazos += flecha(x + ancho + 8, f.y + alto / 2, x + ancho + 30, f.y + alto / 2, { ancho: 2 });
        textos += rotulo(x + ancho + 40, f.y + alto / 2 - 3, f.t, { tam: 13.5, anclaje: 'start', peso: 600 });
        textos += rotulo(x + ancho + 40, f.y + alto / 2 + 15, f.d,
          { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      }
      trazos += flecha(36, 46, 36, 268, { color: TINTA_SUAVE, ancho: 1.4 });
      textos += rotulo(26, 160, 'ciclos', { tam: 12.5, anclaje: 'middle', color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'freno-disco': {
    que: 'El freno de disco: las pastillas aprietan el disco por los dos lados y el rozamiento convierte el movimiento en calor.',
    titulo: 'El freno de disco',
    pie: 'La energía del movimiento no desaparece: se vuelve calor.',
    vista: 'lateral',
    alto: 258,
    dibujo() {
      const cx = 152, cy = 138;
      // Disco con volumen
      let trazos = circulo(cx, cy, 86, { ancho: 2.8, relleno: PAPEL });
      trazos += volumenR(cx, cy, 86);
      trazos += circulo(cx, cy, 79, { ancho: 1, color: TINTA_SUAVE });
      trazos += circulo(cx, cy, 32, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenR(cx, cy, 32);
      trazos += circulo(cx, cy, 11, { ancho: 1.6 });
      for (let a = 0; a < 360; a += 72) {
        const r = 21, rad = (a * Math.PI) / 180;
        trazos += circulo(cx + r * Math.cos(rad), cy + r * Math.sin(rad), 3.2, { ancho: 1.4 });
      }
      trazos += giro(cx, cy, 100, -125, -25, { color: SANGUINA });
      // Pinza
      trazos += camino(`M ${cx - 30} ${cy - 106} h 60 a 9 9 0 0 1 9 9 v 34 a 9 9 0 0 1 -9 9 h -60
        a 9 9 0 0 1 -9 -9 v -34 a 9 9 0 0 1 9 -9 z`, { ancho: 2.4, relleno: PAPEL });
      trazos += volumenH(cx - 30, cy - 106, 78, 52, 9);
      trazos += rayado(cx - 26, cy - 102, 52, 44, { paso: 6, angulo: 45 });
      for (const lado of [-1, 1]) {
        const x = cx + lado * 17;
        trazos += rect(x - 5, cy - 96, 10, 30, { ancho: 2, relleno: PAPEL });
        trazos += flecha(x + lado * 23, cy - 81, x + lado * 8, cy - 81, { ancho: 2.2 });
      }

      // Todos los rótulos a los lados: encima está la pinza y arriba el título.
      let textos = rotulo(cx + 52, cy - 112, 'la pinza aprieta',
        { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(cx + 108, cy - 62, 'gira con', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(cx + 108, cy - 46, 'la rueda', { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
      trazos += linea(cx + 74, cy + 46, cx + 104, cy + 60, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx + 110, cy + 64, 'disco', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      trazos += linea(cx - 32, cy + 22, cx - 74, cy + 52, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx - 80, cy + 56, 'buje', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      trazos += linea(cx - 34, cy - 88, cx - 56, cy - 100, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx - 62, cy - 96, 'pastillas', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'direccion-cremallera': {
    que: 'La dirección de cremallera: el giro del volante se convierte en un desplazamiento lateral que orienta las ruedas.',
    titulo: 'La dirección de cremallera',
    pie: 'Un giro se convierte en un movimiento de lado a lado.',
    vista: 'superior',
    alto: 280,
    dibujo() {
      const cx = W / 2, yCrem = 158;
      let trazos = circulo(cx, 62, 25, { ancho: 3 });
      trazos += circulo(cx, 62, 7, { ancho: 2, relleno: PAPEL });
      trazos += volumenR(cx, 62, 7);
      trazos += camino(`M ${cx - 25} 62 h 18 M ${cx + 7} 62 h 18 M ${cx} 69 v 18`, { ancho: 2.2 });
      trazos += giro(cx, 62, 36, -150, -40, { color: SANGUINA });
      trazos += linea(cx, 87, cx, yCrem - 12, { ancho: 4 });
      trazos += circulo(cx, yCrem - 9, 15, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenR(cx, yCrem - 9, 15);
      for (let a = 0; a < 360; a += 45) {
        const rad = (a * Math.PI) / 180;
        trazos += linea(cx + 15 * Math.cos(rad), yCrem - 9 + 15 * Math.sin(rad),
          cx + 20 * Math.cos(rad), yCrem - 9 + 20 * Math.sin(rad), { ancho: 1.6 });
      }
      trazos += rect(72, yCrem, 276, 20, { ancho: 2.4, radio: 2, relleno: PAPEL });
      trazos += volumenV(72, yCrem, 276, 20, 2);
      for (let x = 80; x < 344; x += 12) {
        trazos += linea(x, yCrem, x, yCrem + 7, { color: TINTA_SUAVE, ancho: 1.3 });
      }
      trazos += flecha(196, yCrem + 38, 268, yCrem + 38, { ancho: 2.4 });
      for (const lado of [-1, 1]) {
        const x = lado < 0 ? 72 : 348;
        trazos += linea(x, yCrem + 10, x + lado * 26, yCrem + 10, { ancho: 2.6 });
        trazos += circulo(x + lado * 26, yCrem + 10, 3.6, { ancho: 1.6 });
        trazos += `<g transform="rotate(14 ${x + lado * 40} ${yCrem + 10})">` +
          rect(x + lado * 40 - 9, yCrem - 20, 18, 60, { ancho: 2.2, radio: 4, relleno: PAPEL }) +
          volumenH(x + lado * 40 - 9, yCrem - 20, 18, 60, 4) +
          rayado(x + lado * 40 - 7, yCrem - 17, 14, 54, { paso: 7, angulo: 70 }) +
          '</g>';
      }
      let textos = rotulo(cx + 46, 40, 'giras', { tam: 13, anclaje: 'start', color: SANGUINA, cursiva: true });
      textos += rotulo(cx + 26, yCrem - 18, 'piñón', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(232, yCrem + 60, 'la cremallera corre',
        { tam: 12.5, color: SANGUINA, cursiva: true });
      textos += rotulo(60, yCrem + 84, 'y las ruedas giran',
        { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'presion-superficie': {
    que: 'Presión, fuerza y superficie: la misma fuerza repartida en más superficie da menos presión.',
    titulo: 'Presión, fuerza y superficie',
    pie: 'Presión = fuerza ÷ superficie. Repartida, la misma fuerza aprieta menos.',
    vista: 'frontal',
    alto: 240,
    dibujo() {
      let trazos = '', textos = '';
      const casos = [
        { cx: 106, ancho: 30, t: 'Poca superficie', d: 'mucha presión' },
        { cx: 296, ancho: 116, t: 'Mucha superficie', d: 'poca presión' },
      ];
      for (const c of casos) {
        const yb = 158;
        trazos += sombraSuelo(c.cx, yb, c.ancho * 0.6, 4);
        trazos += suelo(c.cx - 74, c.cx + 74, yb);
        trazos += rect(c.cx - c.ancho / 2, yb - 44, c.ancho, 44, { ancho: 2.4, relleno: PAPEL });
        trazos += volumenH(c.cx - c.ancho / 2, yb - 44, c.ancho, 44);
        trazos += rayado(c.cx - c.ancho / 2 + 2.5, yb - 41.5, c.ancho - 5, 39, { paso: 7, angulo: 45 });
        trazos += flecha(c.cx, 58, c.cx, yb - 52, { ancho: 3 });
        const n = Math.max(2, Math.round(c.ancho / 18));
        for (let i = 0; i < n; i++) {
          const x = c.cx - c.ancho / 2 + (c.ancho * (i + 0.5)) / n;
          trazos += flecha(x, yb + 3, x, yb + 16, { ancho: 1.6 });
        }
        textos += rotulo(c.cx + 14, 50, 'la misma fuerza',
          { tam: 12.5, anclaje: 'start', color: SANGUINA, cursiva: true });
        textos += rotulo(c.cx, yb + 44, c.t, { tam: 13.5, peso: 600 });
        textos += rotulo(c.cx, yb + 62, c.d, { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  // --- Suspensión y dirección ----------------------------------------------

  'barra-estabilizadora': {
    que: 'La barra estabilizadora: une las dos ruedas de un eje y se retuerce en las curvas para frenar el balanceo.',
    titulo: 'La barra estabilizadora',
    pie: 'Sólo trabaja cuando una rueda sube más que la otra. Si suben las dos igual, no hace nada.',
    vista: 'frontal',
    alto: 250,
    dibujo() {
      const yEje = 150;
      let trazos = '', textos = '';
      // Carrocería inclinada por la curva
      trazos += `<g transform="rotate(-5 210 70)">` +
        rect(96, 46, 228, 34, { ancho: 2.4, radio: 6, relleno: PAPEL }) +
        volumenV(96, 46, 228, 34, 6) + '</g>';
      textos += rotulo(210, 40, 'carrocería', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });

      // Las dos ruedas: la de fuera comprimida, la de dentro extendida
      const ruedas = [
        { cx: 78, dy: 12, t: 'se comprime' },
        { cx: 342, dy: -8, t: 'se extiende' },
      ];
      for (const r of ruedas) {
        trazos += sombraSuelo(r.cx, 214, 24, 4);
        trazos += rect(r.cx - 17, 168 + r.dy, 34, 46, { ancho: 2.2, radio: 7, relleno: PAPEL });
        trazos += volumenH(r.cx - 17, 168 + r.dy, 34, 46, 7);
        trazos += rayado(r.cx - 14, 171 + r.dy, 28, 40, { paso: 8, angulo: 22 });
        textos += rotulo(r.cx, 236, r.t, { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      }
      trazos += suelo(30, W - 30, 214);

      // La barra, que se retuerce entre las dos
      trazos += camino(`M 78 ${yEje + 12} L 78 ${yEje + 2} Q 78 ${yEje - 12} 100 ${yEje - 12}
        L 320 ${yEje - 12} Q 342 ${yEje - 12} 342 ${yEje + 2} L 342 ${yEje - 8}`,
        { color: TINTA_SUAVE, ancho: 5.4 });
      trazos += camino(`M 78 ${yEje + 12} L 78 ${yEje + 2} Q 78 ${yEje - 12} 100 ${yEje - 12}
        L 320 ${yEje - 12} Q 342 ${yEje - 12} 342 ${yEje + 2} L 342 ${yEje - 8}`,
        { ancho: 3 });
      // El retorcimiento
      trazos += giro(210, yEje - 12, 26, 150, 30, { color: SANGUINA });
      textos += rotulo(210, yEje + 34, 'la barra se retuerce',
        { tam: 13, color: SANGUINA, peso: 600 });
      textos += rotulo(210, yEje + 52, 'y tira de la rueda que se ha quedado atrás',
        { tam: 12, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'ballesta': {
    que: 'La ballesta: hojas de acero superpuestas que hacen de muelle y de brazo a la vez, típicas de vehículos de carga.',
    titulo: 'La ballesta',
    pie: 'Cuantas más hojas, más carga aguanta y más dura es la suspensión.',
    vista: 'lateral',
    alto: 240,
    dibujo() {
      const cx = 210, y = 110;
      let trazos = '', textos = '';
      // Chasis y abarcón
      trazos += rect(cx - 26, y - 52, 52, 26, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(cx - 26, y - 52, 52, 26);
      trazos += linea(cx, y - 26, cx, y - 4, { ancho: 4 });
      // Las hojas, de más larga a más corta
      const hojas = [[150, 0], [118, 11], [86, 22], [56, 33]];
      for (const [medio, dy] of hojas) {
        trazos += camino(
          `M ${cx - medio} ${y + dy - 12} Q ${cx} ${y + dy + 8} ${cx + medio} ${y + dy - 12}`,
          { color: TINTA_SUAVE, ancho: 6.4 });
        trazos += camino(
          `M ${cx - medio} ${y + dy - 12} Q ${cx} ${y + dy + 8} ${cx + medio} ${y + dy - 12}`,
          { ancho: 3.4 });
      }
      // Ojos de la ballesta
      trazos += circulo(cx - 150, y - 12, 7, { ancho: 2.2, relleno: PAPEL });
      trazos += circulo(cx + 150, y - 12, 7, { ancho: 2.2, relleno: PAPEL });
      trazos += flecha(cx, y - 84, cx, y - 58, { ancho: 3 });

      textos += rotulo(cx + 18, y - 74, 'carga', { tam: 13, anclaje: 'start', color: SANGUINA, peso: 600 });
      textos += rotulo(cx, y + 78, 'las hojas se rozan entre sí',
        { tam: 13, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(cx, y + 96, 'y ese rozamiento amortigua',
        { tam: 13, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(60, y - 30, 'ojo', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(360, y - 30, 'ojo', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'neumatico-corte': {
    que: 'El neumático por dentro: banda de rodadura, lonas, talón y flanco. También sirve para hablar de presión de inflado.',
    titulo: 'El neumático por dentro',
    pie: 'El aire sostiene el peso; la carcasa le da forma y el talón lo agarra a la llanta.',
    vista: 'corte',
    alto: 270,
    dibujo() {
      const cx = 150, yA = 40, yB = 250;
      let trazos = '', textos = '';
      // Perfil en U del neumático
      const d = `M ${cx - 62} ${yB} L ${cx - 62} ${yA + 58}
        Q ${cx - 62} ${yA} ${cx} ${yA} Q ${cx + 62} ${yA} ${cx + 62} ${yA + 58}
        L ${cx + 62} ${yB} L ${cx + 40} ${yB} L ${cx + 40} ${yA + 62}
        Q ${cx + 40} ${yA + 24} ${cx} ${yA + 24} Q ${cx - 40} ${yA + 24} ${cx - 40} ${yA + 62}
        L ${cx - 40} ${yB} Z`;
      trazos += camino(d, { ancho: 2.6, relleno: PAPEL });
      trazos += rayado(cx - 62, yA, 124, yB - yA, { paso: 7, angulo: 45 });
      // Banda de rodadura
      for (let i = -3; i <= 3; i++) {
        trazos += linea(cx + i * 15, yA - 2, cx + i * 15, yA + 12, { ancho: 2.2 });
      }
      // Talones
      trazos += circulo(cx - 51, yB - 12, 7, { ancho: 2.2, relleno: PAPEL });
      trazos += circulo(cx + 51, yB - 12, 7, { ancho: 2.2, relleno: PAPEL });
      // Llanta
      trazos += rect(cx - 58, yB - 6, 116, 14, { ancho: 2.4, relleno: PAPEL });
      trazos += volumenV(cx - 58, yB - 6, 116, 14);
      // El aire, empujando desde dentro
      for (const [ax, ay, bx, by] of [[cx, yA + 96, cx, yA + 44], [cx - 22, yA + 96, cx - 34, yA + 62], [cx + 22, yA + 96, cx + 34, yA + 62]]) {
        trazos += flecha(ax, ay, bx, by, { ancho: 1.8 });
      }
      textos += rotulo(cx, yA + 116, 'el aire empuja', { tam: 12.5, color: SANGUINA, cursiva: true });

      const notas = [
        [yA + 6, 'banda de rodadura'],
        [yA + 70, 'flanco'],
        [yB - 12, 'talón'],
        [yB + 4, 'llanta'],
      ];
      for (const [y, t] of notas) {
        trazos += linea(cx + 68, y, cx + 96, y, { color: TINTA_SUAVE, ancho: 1.1 });
        textos += rotulo(cx + 102, y + 5, t, { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      }
      return { trazos, textos };
    },
  },

  'direccion-asistida': {
    que: 'La dirección asistida: una bomba manda aceite a presión al lado del pistón que ayuda al giro.',
    titulo: 'La dirección asistida',
    pie: 'La asistencia ayuda, no dirige: si falla, el volante sigue moviendo las ruedas, pero cuesta.',
    vista: 'corte',
    alto: 250,
    dibujo() {
      let trazos = '', textos = '';
      const yC = 130;
      // Cilindro con el pistón dentro
      trazos += rect(78, yC - 26, 264, 52, { ancho: 2.6, radio: 5, relleno: PAPEL });
      trazos += volumenH(78, yC - 26, 264, 52, 5);
      trazos += rect(196, yC - 24, 22, 48, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(196, yC - 24, 22, 48);
      trazos += linea(218, yC, 342, yC, { ancho: 5 });
      trazos += linea(78, yC, 196, yC, { ancho: 5 });
      // Aceite a presión en la cámara de la izquierda
      trazos += rayado(82, yC - 22, 112, 44, { paso: 6, angulo: 0 });
      trazos += flecha(150, yC, 190, yC, { ancho: 3 });
      // Bomba
      trazos += circulo(120, yC - 76, 24, { ancho: 2.4, relleno: PAPEL });
      trazos += volumenR(120, yC - 76, 24);
      trazos += giro(120, yC - 76, 32, -150, -30, { color: SANGUINA });
      trazos += camino(`M 120 ${yC - 52} L 120 ${yC - 34} L 100 ${yC - 34} L 100 ${yC - 22}`,
        { ancho: 2.6 });

      textos += rotulo(150, yC - 84, 'bomba', { tam: 13, anclaje: 'start', peso: 600 });
      textos += rotulo(150, yC - 66, 'movida por el motor',
        { tam: 12, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(122, yC + 44, 'aceite a presión', { tam: 12.5, color: SANGUINA, cursiva: true });
      textos += rotulo(280, yC + 44, 'el pistón empuja', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      textos += rotulo(280, yC + 62, 'y ayuda a girar', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },

  'freno-tambor': {
    que: 'El freno de tambor: las zapatas se abren contra la cara interior del tambor.',
    titulo: 'El freno de tambor',
    pie: 'Encerrado, disipa peor el calor que un disco; por eso se deja para el eje trasero.',
    vista: 'lateral',
    alto: 250,
    dibujo() {
      const cx = 150, cy = 128;
      let trazos = circulo(cx, cy, 88, { ancho: 3, relleno: PAPEL });
      trazos += volumenR(cx, cy, 88);
      trazos += circulo(cx, cy, 78, { ancho: 1.6, color: TINTA_SUAVE });
      // Las dos zapatas, arcos gruesos
      for (const lado of [-1, 1]) {
        const a0 = lado < 0 ? 100 : -80;
        trazos += `<path d="M ${cx + lado * 66} ${cy - 40} A 74 74 0 0 ${lado < 0 ? 0 : 1} ${cx + lado * 66} ${cy + 40}"
          fill="none" stroke="${TINTA}" stroke-width="9" stroke-linecap="round"/>`;
        trazos += flecha(cx + lado * 34, cy, cx + lado * 58, cy, { ancho: 2.4 });
      }
      // Bombín arriba y muelle abajo
      trazos += rect(cx - 16, cy - 78, 32, 16, { ancho: 2.2, relleno: PAPEL });
      trazos += volumenV(cx - 16, cy - 78, 32, 16);
      trazos += camino(`M ${cx - 40} ${cy + 62} l 10 -8 l 12 16 l 12 -16 l 10 8`,
        { color: TINTA_SUAVE, ancho: 2.4 });
      trazos += circulo(cx, cy, 16, { ancho: 2, relleno: PAPEL });

      let textos = rotulo(cx + 100, cy - 70, 'bombín', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      trazos += linea(cx + 18, cy - 70, cx + 96, cy - 74, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx + 100, cy + 6, 'tambor', { tam: 12.5, anclaje: 'start', color: TINTA_SUAVE, cursiva: true });
      trazos += linea(cx + 86, cy + 2, cx + 96, cy + 2, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx - 100, cy + 6, 'zapatas', { tam: 12.5, anclaje: 'end', color: TINTA_SUAVE, cursiva: true });
      trazos += linea(cx - 70, cy + 2, cx - 96, cy + 2, { color: TINTA_SUAVE, ancho: 1.1 });
      textos += rotulo(cx, cy + 108, 'se abren contra el tambor',
        { tam: 13, color: SANGUINA, peso: 600 });
      return { trazos, textos };
    },
  },

  'palanca': {
    que: 'La palanca: fuerza, apoyo y resistencia. La base de casi todo lo que multiplica fuerza en un vehículo.',
    titulo: 'La palanca',
    pie: 'Cuanto más lejos del apoyo empujas, menos fuerza necesitas.',
    vista: 'lateral',
    alto: 250,
    dibujo() {
      const yBarra = 120, xApoyo = 250;
      let trazos = '', textos = '';
      // Barra con volumen
      trazos += `<g transform="rotate(-6 ${xApoyo} ${yBarra})">` +
        rect(50, yBarra - 8, 320, 16, { ancho: 2.4, radio: 4, relleno: PAPEL }) +
        volumenV(50, yBarra - 8, 320, 16, 4) + '</g>';
      // Apoyo: triángulo
      trazos += camino(`M ${xApoyo - 22} ${yBarra + 52} L ${xApoyo} ${yBarra + 10} L ${xApoyo + 22} ${yBarra + 52} Z`,
        { ancho: 2.4, relleno: PAPEL });
      trazos += rayado(xApoyo - 20, yBarra + 20, 40, 32, { paso: 6, angulo: 45 });
      trazos += suelo(xApoyo - 70, xApoyo + 70, yBarra + 52);
      // Fuerza en el extremo largo, resistencia en el corto
      trazos += flecha(72, yBarra - 66, 72, yBarra - 22, { ancho: 3 });
      trazos += flecha(340, yBarra - 4, 340, yBarra - 48, { ancho: 3.6 });
      trazos += cota(50, yBarra + 78, xApoyo, yBarra + 78);
      trazos += cota(xApoyo, yBarra + 78, 370, yBarra + 78);
      textos += rotuloCota(50, yBarra + 78, xApoyo, yBarra + 78, 'brazo largo');
      textos += rotuloCota(xApoyo, yBarra + 78, 370, yBarra + 78, 'corto');

      textos += rotulo(72, yBarra - 74, 'empujas poco', { tam: 13, color: SANGUINA, peso: 600 });
      textos += rotulo(340, yBarra - 56, 'levanta mucho', { tam: 13, color: SANGUINA, peso: 600 });
      textos += rotulo(xApoyo, yBarra + 118, 'apoyo', { tam: 12.5, color: TINTA_SUAVE, cursiva: true });
      return { trazos, textos };
    },
  },
};

export const NOMBRES = Object.keys(CATALOGO);

/** Construye la lámina de uno de los dibujos del catálogo. */
export function construirDibujo(nombre, tituloPropio = '') {
  const e = CATALOGO[nombre];
  if (!e) return null;
  return lamina({
    titulo: tituloPropio || e.titulo,
    pie: e.pie,
    vista: e.vista,
    alto: e.alto,
    dibujo: e.dibujo(),
  });
}
