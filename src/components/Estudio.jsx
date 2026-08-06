import { useEffect, useState } from 'react';
import TarjetaPregunta from './TarjetaPregunta.jsx';
import { Barra, Boton, Cabecera, Icono } from './ui.jsx';
import { useSwipe } from '../hooks/useSwipe.js';
import { marcadas as almacenMarcadas } from '../lib/almacen.js';

/** Modo estudio: sin responder, sólo leer. Respuesta correcta ya en verde. */
export default function Estudio({ preguntas, titulo, alSalir }) {
  const [indice, setIndice] = useState(0);
  const [marcas, setMarcas] = useState(() => new Set(almacenMarcadas.todas()));
  const total = preguntas.length;
  const actual = preguntas[indice];

  function ir(nuevo) {
    if (nuevo < 0 || nuevo >= total) return;
    setIndice(nuevo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const { ref: zonaGesto, manejadores, desplazamiento, arrastrando } = useSwipe({
    alIzquierda: () => ir(indice + 1),
    alDerecha: () => ir(indice - 1),
  });

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') ir(indice + 1);
      else if (e.key === 'ArrowLeft') ir(indice - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!actual) return null;

  return (
    <div className="min-h-dvh pb-28">
      <Cabecera titulo="Modo estudio" subtitulo={titulo} alVolver={alSalir} />
      <div className="mx-auto max-w-5xl px-4">
        <div className="pt-3">
          <Barra valor={indice + 1} total={total} color="bg-emerald-500" />
        </div>

        <div
          ref={zonaGesto}
          {...manejadores}
          className="pt-5"
          style={{
            ...manejadores.style,
            transform: `translateX(${desplazamiento}px)`,
            transition: arrastrando ? 'none' : 'transform 200ms ease-out',
          }}
        >
          <TarjetaPregunta
            pregunta={actual}
            modo="estudio"
            marcada={marcas.has(actual.id)}
            alMarcar={() => {
              almacenMarcadas.alternar(actual.id);
              setMarcas(new Set(almacenMarcadas.todas()));
            }}
            numero={indice + 1}
            total={total}
          />
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          Desliza para avanzar · barra espaciadora en el ordenador
        </p>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* La salida también aquí: la cabecera se pierde al desplazarse. */}
          <button
            onClick={alSalir}
            aria-label="Salir al menú"
            className="shrink-0 rounded-xl p-3 text-slate-500 active:scale-95 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icono nombre="casa" size={20} />
          </button>
          <Boton
            variante="secundario"
            onClick={() => ir(indice - 1)}
            disabled={indice === 0}
            aria-label="Anterior"
            className="flex-1"
          >
            <Icono nombre="izquierda" size={18} />
            <span className="hidden sm:inline">Anterior</span>
          </Boton>
          <Boton
            onClick={() => ir(indice + 1)}
            disabled={indice === total - 1}
            aria-label="Siguiente"
            className="flex-1"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <Icono nombre="derecha" size={18} />
          </Boton>
        </div>
      </nav>
    </div>
  );
}
