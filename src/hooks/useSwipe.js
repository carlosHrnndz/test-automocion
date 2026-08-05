import { useRef, useState, useCallback } from 'react';

/**
 * Swipe horizontal con Pointer Events (funciona con dedo, ratón y lápiz).
 *
 * Dos cosas que en el móvil son imprescindibles y no son obvias:
 *
 * 1. Se captura el puntero en cuanto se decide que el gesto es horizontal.
 *    Sin eso, al arrastrar el dedo fuera del elemento —o sobre un botón de
 *    dentro— los eventos dejan de llegar, nunca salta el "pointerup" y el
 *    gesto se pierde. Era la razón por la que en el móvil no pasaba nada.
 *
 * 2. `touch-action: pan-y` deja el scroll vertical al navegador y nos reserva
 *    el horizontal. Si se omite, el navegador se queda el gesto entero.
 *
 * Ignora los gestos que empiezan sobre un elemento marcado con
 * [data-sin-swipe], pensado para zonas que tengan su propio desplazamiento
 * horizontal (un carrusel, una tabla ancha). No se debe marcar así el texto
 * normal: pasar de pregunta tiene que funcionar desde cualquier sitio.
 *
 * Devuelve { manejadores, desplazamiento, arrastrando }.
 */
export function useSwipe({ alIzquierda, alDerecha, umbral = 60, activo = true } = {}) {
  const inicio = useRef(null);
  const eje = useRef(null);        // 'x' | 'y' | null
  const capturado = useRef(false);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);

  const limpiar = useCallback(() => {
    inicio.current = null;
    eje.current = null;
    capturado.current = false;
    setArrastrando(false);
    setDesplazamiento(0);
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (!activo) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('[data-sin-swipe]')) return;
      inicio.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
      eje.current = null;
      capturado.current = false;
      setArrastrando(true);
    },
    [activo]
  );

  const onPointerMove = useCallback((e) => {
    const ini = inicio.current;
    if (!ini) return;
    const dx = e.clientX - ini.x;
    const dy = e.clientY - ini.y;

    if (eje.current === null) {
      // Hasta que el gesto no se define, no se hace nada: así un toque para
      // responder sigue siendo un toque, y un scroll sigue siendo un scroll.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      eje.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

      // A partir de aquí el gesto es nuestro: se captura para que no se
      // escape aunque el dedo pase por encima de un botón o salga del área.
      if (eje.current === 'x') {
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          capturado.current = true;
        } catch { /* si el navegador no deja, se sigue sin captura */ }
      }
    }
    if (eje.current !== 'x') return;

    // Resistencia: cuanto más arrastras, menos se mueve.
    setDesplazamiento(Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 120));
  }, []);

  const terminar = useCallback(
    (e) => {
      const ini = inicio.current;
      const eraX = eje.current === 'x';
      if (capturado.current) {
        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ya soltado */ }
      }
      limpiar();
      if (!ini || !eraX) return;

      const dx = e.clientX - ini.x;
      // Un gesto rápido cuenta aunque sea corto: así se puede pasar de
      // pregunta con un golpe de pulgar sin recorrer media pantalla.
      const rapido = Date.now() - ini.t < 350 && Math.abs(dx) > 30;
      if (dx <= -umbral || (rapido && dx < 0)) alIzquierda?.();
      else if (dx >= umbral || (rapido && dx > 0)) alDerecha?.();
    },
    [alIzquierda, alDerecha, umbral, limpiar]
  );

  return {
    manejadores: {
      onPointerDown,
      onPointerMove,
      onPointerUp: terminar,
      onPointerCancel: limpiar,
      // Si el sistema le quita la captura al elemento (una llamada entrante,
      // el gesto de "atrás" del móvil), se deja todo como estaba.
      onLostPointerCapture: limpiar,
      style: { touchAction: 'pan-y' },
    },
    desplazamiento,
    arrastrando,
  };
}
