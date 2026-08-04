import { useRef, useState, useCallback } from 'react';

/**
 * Swipe horizontal con Pointer Events (funciona con dedo, ratón y lápiz).
 *
 * - Ignora gestos que empiezan sobre un elemento con [data-sin-swipe]
 *   (por ejemplo el área de scroll de la explicación).
 * - Sólo se activa si el movimiento es claramente horizontal, para no
 *   pelearse con el scroll vertical de la página.
 *
 * Devuelve { manejadores, desplazamiento, arrastrando }.
 * `desplazamiento` sirve para animar la tarjeta mientras arrastras.
 */
export function useSwipe({ alIzquierda, alDerecha, umbral = 70, activo = true } = {}) {
  const inicio = useRef(null);
  const eje = useRef(null); // 'x' | 'y' | null
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);

  const onPointerDown = useCallback(
    (e) => {
      if (!activo) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('[data-sin-swipe]')) return;
      inicio.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      eje.current = null;
      setArrastrando(true);
    },
    [activo]
  );

  const onPointerMove = useCallback((e) => {
    if (!inicio.current) return;
    const dx = e.clientX - inicio.current.x;
    const dy = e.clientY - inicio.current.y;

    if (eje.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      eje.current = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    }
    if (eje.current !== 'x') return;

    // Resistencia: cuanto más arrastras, menos se mueve.
    setDesplazamiento(Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 120));
  }, []);

  const terminar = useCallback(
    (e) => {
      const ini = inicio.current;
      inicio.current = null;
      setArrastrando(false);
      setDesplazamiento(0);
      if (!ini || eje.current !== 'x') return;

      const dx = e.clientX - ini.x;
      const rapido = Date.now() - ini.t < 300 && Math.abs(dx) > 35;
      if (dx <= -umbral || (rapido && dx < 0)) alIzquierda?.();
      else if (dx >= umbral || (rapido && dx > 0)) alDerecha?.();
    },
    [alIzquierda, alDerecha, umbral]
  );

  return {
    manejadores: {
      onPointerDown,
      onPointerMove,
      onPointerUp: terminar,
      onPointerCancel: () => {
        inicio.current = null;
        setArrastrando(false);
        setDesplazamiento(0);
      },
      style: { touchAction: 'pan-y' },
    },
    desplazamiento,
    arrastrando,
  };
}
