import { useEffect, useMemo, useRef, useState } from 'react';
import TarjetaPregunta from './TarjetaPregunta.jsx';
import { Barra, Boton, Cabecera, Icono } from './ui.jsx';
import { useSwipe } from '../hooks/useSwipe.js';
import { estadisticas, marcadas as almacenMarcadas, sesion as almacenSesion } from '../lib/almacen.js';

export default function Test({ preguntas, titulo, subtitulo, ajustes, alSalir, alTerminar, sesionInicial }) {
  const [indice, setIndice] = useState(sesionInicial?.indice ?? 0);
  const [respuestas, setRespuestas] = useState(sesionInicial?.respuestas ?? {});
  const [marcas, setMarcas] = useState(() => new Set(almacenMarcadas.todas()));
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const inicioRef = useRef(sesionInicial?.inicio ?? Date.now());
  const temporizador = useRef(null);

  const total = preguntas.length;
  const actual = preguntas[indice];
  const respondidas = Object.keys(respuestas).length;
  const aciertos = useMemo(
    () => preguntas.reduce((n, p, i) => n + (respuestas[i] === p.correcta ? 1 : 0), 0),
    [preguntas, respuestas]
  );

  // Guarda la sesión para poder reanudarla si cierras la app.
  //
  // Se guarda el ORDEN de las opciones tal y como lo estás viendo, no sólo el
  // identificador de la pregunta. Antes se guardaban sólo los identificadores
  // y al reanudar se volvían a sacar del banco sin barajar: parecía que la
  // opción «Barajar las opciones» no hacía nada, y peor todavía, las
  // respuestas que ya habías dado apuntaban a posiciones distintas, así que un
  // acierto podía aparecer como fallo.
  useEffect(() => {
    almacenSesion.guardar({
      titulo,
      subtitulo,
      inicio: inicioRef.current,
      indice,
      respuestas,
      ids: preguntas.map((p) => p.id),
      orden: preguntas.map((p) => ({ id: p.id, opciones: p.opciones, correcta: p.correcta })),
    });
  }, [indice, respuestas, preguntas, titulo, subtitulo]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function ir(nuevo) {
    if (nuevo < 0 || nuevo >= total) return;
    clearTimeout(temporizador.current);
    setIndice(nuevo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function responder(opcion) {
    if (respuestas[indice] !== undefined) return;
    const acertada = opcion === actual.correcta;
    setRespuestas((r) => ({ ...r, [indice]: opcion }));
    estadisticas.registrar(actual.id, acertada);

    if (ajustes.avanceAutomatico && acertada && indice < total - 1) {
      temporizador.current = setTimeout(() => ir(indice + 1), 1100);
    }
  }

  function alternarMarca() {
    almacenMarcadas.alternar(actual.id);
    setMarcas(new Set(almacenMarcadas.todas()));
  }

  function terminar() {
    almacenSesion.borrar();
    alTerminar({
      preguntas,
      respuestas,
      titulo,
      subtitulo,
      segundos: Math.round((Date.now() - inicioRef.current) / 1000),
    });
  }

  const { ref: zonaGesto, manejadores, desplazamiento, arrastrando } = useSwipe({
    alIzquierda: () => ir(indice + 1),
    alDerecha: () => ir(indice - 1),
  });

  // Teclado en escritorio: 1-9 responde, flechas navegan, M marca.
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') ir(indice + 1);
      else if (e.key === 'ArrowLeft') ir(indice - 1);
      else if (e.key.toLowerCase() === 'm') alternarMarca();
      else if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < actual.opciones.length) responder(i);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!actual) return null;

  return (
    <div className="min-h-dvh pb-28">
      <Cabecera
        titulo={titulo}
        subtitulo={`${respondidas} de ${total} respondidas · ${aciertos} aciertos`}
        alVolver={() => setConfirmarSalida(true)}
        derecha={
          <button
            onClick={() => setPanelAbierto(true)}
            aria-label="Índice de preguntas"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icono nombre="lista" />
          </button>
        }
      />
      <div className="mx-auto max-w-5xl px-4">
        <div className="pt-3">
          <Barra valor={respondidas} total={total} />
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
            seleccionada={respuestas[indice] ?? null}
            alResponder={responder}
            marcada={marcas.has(actual.id)}
            alMarcar={alternarMarca}
            numero={indice + 1}
            total={total}
          />
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          Desliza a los lados para cambiar de pregunta · teclas 1-4, flechas y M
        </p>
      </div>

      {/* Barra inferior.
          Aquí está también la salida y el índice: la cabecera se va hacia
          arriba al desplazarse y en el móvil te quedabas sin manera de volver
          al menú. Esta barra está siempre fija a la vista. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setConfirmarSalida(true)}
            aria-label="Salir al menú"
            className="shrink-0 rounded-xl p-3 text-slate-500 active:scale-95 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icono nombre="casa" size={20} />
          </button>

          <Boton
            variante="secundario"
            onClick={() => ir(indice - 1)}
            disabled={indice === 0}
            aria-label="Pregunta anterior"
            className="flex-1"
          >
            <Icono nombre="izquierda" size={18} />
            <span className="hidden sm:inline">Anterior</span>
          </Boton>

          {indice === total - 1 ? (
            <Boton onClick={terminar} className="flex-1">
              Finalizar
            </Boton>
          ) : (
            <Boton onClick={() => ir(indice + 1)} aria-label="Pregunta siguiente" className="flex-1">
              <span className="hidden sm:inline">Siguiente</span>
              <Icono nombre="derecha" size={18} />
            </Boton>
          )}

          <button
            onClick={() => setPanelAbierto(true)}
            aria-label="Índice de preguntas"
            className="shrink-0 rounded-xl p-3 text-slate-500 active:scale-95 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Icono nombre="lista" size={20} />
          </button>
        </div>
      </nav>

      {panelAbierto && (
        <PanelIndice
          preguntas={preguntas}
          respuestas={respuestas}
          marcas={marcas}
          indice={indice}
          alElegir={(i) => {
            setPanelAbierto(false);
            ir(i);
          }}
          alCerrar={() => setPanelAbierto(false)}
          alFinalizar={() => {
            setPanelAbierto(false);
            terminar();
          }}
        />
      )}

      {confirmarSalida && (
        <Dialogo
          titulo="¿Salir del test?"
          texto={`Llevas ${respondidas} de ${total} preguntas. Puedes guardarlo y reanudarlo más tarde desde el inicio.`}
          alCerrar={() => setConfirmarSalida(false)}
          acciones={
            <>
              <Boton variante="secundario" onClick={() => setConfirmarSalida(false)} className="flex-1">
                Seguir
              </Boton>
              <Boton variante="fantasma" onClick={alSalir} className="flex-1">
                Guardar y salir
              </Boton>
              <Boton onClick={terminar} className="flex-1">
                Corregir ya
              </Boton>
            </>
          }
        />
      )}
    </div>
  );
}

function PanelIndice({ preguntas, respuestas, marcas, indice, alElegir, alCerrar, alFinalizar }) {
  const [filtro, setFiltro] = useState('todas');

  const indices = preguntas
    .map((p, i) => i)
    .filter((i) => {
      if (filtro === 'marcadas') return marcas.has(preguntas[i].id);
      if (filtro === 'sin-responder') return respuestas[i] === undefined;
      if (filtro === 'falladas') return respuestas[i] !== undefined && respuestas[i] !== preguntas[i].correcta;
      return true;
    });

  const filtros = [
    ['todas', 'Todas'],
    ['marcadas', 'Marcadas'],
    ['sin-responder', 'Sin responder'],
    ['falladas', 'Falladas'],
  ];

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={alCerrar}>
      <div
        className="max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="mb-4 flex flex-wrap gap-2">
          {filtros.map(([id, texto]) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filtro === id
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {indices.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No hay preguntas en este filtro.</p>
        ) : (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {indices.map((i) => {
              const r = respuestas[i];
              const estado =
                r === undefined ? 'pendiente' : r === preguntas[i].correcta ? 'bien' : 'mal';
              const clases = {
                pendiente: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                bien: 'bg-emerald-500 text-white',
                mal: 'bg-rose-500 text-white',
              }[estado];
              return (
                <button
                  key={i}
                  onClick={() => alElegir(i)}
                  className={`relative aspect-square rounded-lg text-sm font-bold transition active:scale-95 ${clases} ${
                    i === indice ? 'ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                  }`}
                >
                  {i + 1}
                  {marcas.has(preguntas[i].id) && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Boton variante="secundario" onClick={alCerrar} className="flex-1">
            Cerrar
          </Boton>
          <Boton onClick={alFinalizar} className="flex-1">
            Finalizar test
          </Boton>
        </div>
      </div>
    </div>
  );
}

export function Dialogo({ titulo, texto, acciones, alCerrar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={alCerrar}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{titulo}</h3>
        {texto && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{texto}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">{acciones}</div>
      </div>
    </div>
  );
}
