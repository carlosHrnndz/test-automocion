import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Deslizar horizontalmente para cambiar de pregunta.
 *
 * Va con eventos táctiles nativos (touchstart / touchmove / touchend) puestos a
 * mano sobre el elemento, no con las props de React. Hay dos motivos, y los dos
 * se descubrieron probando en un iPhone de verdad:
 *
 * 1. React registra `onTouchMove` como oyente PASIVO, y un oyente pasivo tiene
 *    prohibido llamar a preventDefault(). Sin preventDefault, Safari se queda
 *    el gesto para hacer scroll o para su "volver atrás" y a nosotros no nos
 *    llega nada. Poniendo el oyente a mano con { passive: false } sí se puede.
 *
 * 2. Los Pointer Events, que es lo que se usaba antes, funcionan en el
 *    escritorio pero en iOS los cancela el propio sistema en cuanto sospecha
 *    que quieres desplazarte. Los eventos táctiles son los de casa allí.
 *
 * El ratón sigue funcionando aparte, con Pointer Events, que en el escritorio
 * no dan problemas.
 *
 * Devuelve { ref, manejadores, desplazamiento, arrastrando }:
 * el `ref` hay que ponerlo en el mismo elemento que los `manejadores`.
 */
export function useSwipe({ alIzquierda, alDerecha, umbral = 55, activo = true } = {}) {
  const ref = useRef(null);
  const inicio = useRef(null);
  const eje = useRef(null);            // 'x' | 'y' | null
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);

  // Las funciones que recibe el hook cambian en cada render (son flechas
  // nuevas). Se guardan en una caja para que los oyentes nativos no haya que
  // volver a registrarlos cada vez.
  const acciones = useRef({ alIzquierda, alDerecha, umbral, activo });
  acciones.current = { alIzquierda, alDerecha, umbral, activo };

  const limpiar = useCallback(() => {
    inicio.current = null;
    eje.current = null;
    setArrastrando(false);
    setDesplazamiento(0);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const empezar = (x, y, destino) => {
      if (!acciones.current.activo) return;
      if (destino?.closest && destino.closest('[data-sin-swipe]')) return;
      inicio.current = { x, y, t: Date.now() };
      eje.current = null;
      setArrastrando(true);
    };

    const mover = (x, y, e) => {
      const ini = inicio.current;
      if (!ini) return;
      const dx = x - ini.x;
      const dy = y - ini.y;

      if (eje.current === null) {
        // Hasta que no está claro hacia dónde va, no se toca nada: así un
        // toque sigue siendo un toque y un scroll sigue siendo un scroll.
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        eje.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (eje.current !== 'x') return;

      // Es nuestro: se le dice al navegador que no lo use para desplazar.
      if (e.cancelable) e.preventDefault();
      setDesplazamiento(Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 120));
    };

    const acabar = (x) => {
      const ini = inicio.current;
      const eraX = eje.current === 'x';
      limpiar();
      if (!ini || !eraX) return;

      const dx = x - ini.x;
      const { umbral: u, alIzquierda: izq, alDerecha: der } = acciones.current;
      // Un gesto rápido cuenta aunque sea corto: es como se pasa con el pulgar.
      const rapido = Date.now() - ini.t < 350 && Math.abs(dx) > 30;
      if (dx <= -u || (rapido && dx < 0)) izq?.();
      else if (dx >= u || (rapido && dx > 0)) der?.();
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return limpiar();   // dos dedos: es un zoom
      empezar(e.touches[0].clientX, e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return limpiar();
      mover(e.touches[0].clientX, e.touches[0].clientY, e);
    };
    const onTouchEnd = (e) => acabar(e.changedTouches[0]?.clientX ?? 0);

    // passive:false es lo que permite llamar a preventDefault en touchmove.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', limpiar, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', limpiar);
    };
  }, [limpiar]);

  // --- Ratón y lápiz en el escritorio ---------------------------------------
  // Aquí sí valen los Pointer Events. Se ignora el dedo para no duplicar el
  // gesto: de eso ya se encargan los eventos táctiles de arriba.
  const raton = useRef(null);

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' || !activo) return;
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('[data-sin-swipe]')) return;
    raton.current = { x: e.clientX, y: e.clientY, t: Date.now(), eje: null };
    setArrastrando(true);
  };

  const onPointerMove = (e) => {
    const ini = raton.current;
    if (!ini) return;
    const dx = e.clientX - ini.x;
    const dy = e.clientY - ini.y;
    if (ini.eje === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      ini.eje = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (ini.eje === 'x') {
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* da igual */ }
      }
    }
    if (ini.eje !== 'x') return;
    setDesplazamiento(Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 120));
  };

  const onPointerUp = (e) => {
    const ini = raton.current;
    raton.current = null;
    setArrastrando(false);
    setDesplazamiento(0);
    if (!ini || ini.eje !== 'x') return;
    const dx = e.clientX - ini.x;
    const rapido = Date.now() - ini.t < 350 && Math.abs(dx) > 30;
    if (dx <= -umbral || (rapido && dx < 0)) alIzquierda?.();
    else if (dx >= umbral || (rapido && dx > 0)) alDerecha?.();
  };

  const soltar = () => {
    raton.current = null;
    setArrastrando(false);
    setDesplazamiento(0);
  };

  return {
    ref,
    manejadores: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: soltar,
      onLostPointerCapture: soltar,
      // Deja el desplazamiento vertical al navegador y nos reserva el
      // horizontal. Sin esto, Safari se queda el gesto entero.
      style: { touchAction: 'pan-y' },
    },
    desplazamiento,
    arrastrando,
  };
}
