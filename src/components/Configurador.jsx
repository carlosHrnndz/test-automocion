import { useMemo, useState } from 'react';
import { Boton, Cabecera, Etiqueta, Icono, Tarjeta } from './ui.jsx';
import { CANTIDADES } from '../lib/estructura.js';
import { filtrar } from '../lib/banco.js';

/**
 * Elegir qué entra en el test: módulo -> submódulo -> cantidad.
 * Sirve tanto para el modo test como para el modo estudio (destino).
 */
export default function Configurador({ banco, modulos, destino = 'test', alEmpezar, alVolver }) {
  const [moduloId, setModuloId] = useState(null);
  const [submoduloId, setSubmoduloId] = useState('todos');
  const [cantidad, setCantidad] = useState(25);
  const [aleatorio, setAleatorio] = useState(true);

  const modulo = modulos.find((m) => m.id === moduloId) || null;

  const disponibles = useMemo(() => {
    if (!moduloId) return [];
    return filtrar(banco, { moduloId, submoduloId });
  }, [banco, moduloId, submoduloId]);

  const maximo = disponibles.length;
  const cantidadEfectiva = cantidad !== 'todas' && cantidad > maximo ? 'todas' : cantidad;

  // Paso 1: elegir módulo
  if (!moduloId) {
    return (
      <div className="min-h-dvh pb-16">
        <Cabecera
          titulo={destino === 'estudio' ? 'Modo estudio' : 'Nuevo test'}
          subtitulo="Elige el módulo"
          alVolver={alVolver}
        />
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5">
          {modulos.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setModuloId(m.id);
                setSubmoduloId('todos');
              }}
              className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/85 bg-white/90 p-4 text-left shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/70 hover:shadow-md active:scale-[0.99] dark:border-slate-800/90 dark:bg-slate-900/80 dark:hover:border-sky-500/60"
            >
              <span
                className="h-11 w-1.5 shrink-0 rounded-full"
                style={{ background: m.color, boxShadow: `0 0 12px ${m.color}66` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                  {m.nombre}
                </span>
                <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {m.total} preguntas · {m.submodulos.length} temas
                </span>
              </span>
              <Icono
                nombre="derecha"
                size={18}
                className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Paso 2: submódulo + cantidad
  return (
    <div className="min-h-dvh pb-32">
      <Cabecera
        titulo={modulo.corto || modulo.nombre}
        subtitulo={`${modulo.total} preguntas en el módulo`}
        alVolver={() => setModuloId(null)}
      />
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5">
        <section>
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Tema
          </h2>
          <div className="flex flex-col gap-2">
            <OpcionFila
              activa={submoduloId === 'todos'}
              titulo="Módulo completo"
              detalle={`${modulo.total} preguntas`}
              onClick={() => setSubmoduloId('todos')}
            />
            {modulo.submodulos.map((s) => (
              <OpcionFila
                key={s.id}
                activa={submoduloId === s.id}
                titulo={s.nombre}
                detalle={`${s.total} preguntas`}
                onClick={() => setSubmoduloId(s.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Número de preguntas
          </h2>
          <div className="flex flex-wrap gap-2">
            {CANTIDADES.map((c) => {
              const desactivada = c !== 'todas' && c > maximo;
              return (
                <button
                  key={c}
                  disabled={desactivada}
                  onClick={() => setCantidad(c)}
                  className={`min-w-[68px] rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all disabled:opacity-30 ${
                    cantidadEfectiva === c
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/25 ring-1 ring-inset ring-white/20'
                      : 'border border-slate-200/80 bg-white/90 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {c === 'todas' ? `Todas (${maximo})` : c}
                </button>
              );
            })}
          </div>
          {maximo === 0 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Este tema todavía no tiene preguntas.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Orden
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setAleatorio(true)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${
                aleatorio
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/25 ring-1 ring-inset ring-white/20'
                  : 'border border-slate-200/80 bg-white/90 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
              }`}
            >
              Aleatorio
            </button>
            <button
              onClick={() => setAleatorio(false)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${
                !aleatorio
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/25 ring-1 ring-inset ring-white/20'
                  : 'border border-slate-200/80 bg-white/90 text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200'
              }`}
            >
              Del temario
            </button>
          </div>
        </section>

        <Tarjeta className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60">
          <Icono nombre={destino === 'estudio' ? 'libro' : 'play'} className="text-sky-500" />
          <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">
            {destino === 'estudio'
              ? 'Verás cada pregunta con su respuesta correcta, la explicación y el ejemplo.'
              : 'Al responder verás si has acertado, por qué y un ejemplo práctico.'}
          </p>
        </Tarjeta>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto max-w-5xl">
          <Boton
            className="w-full py-4 text-base"
            disabled={maximo === 0}
            onClick={() =>
              alEmpezar({
                moduloId,
                submoduloId,
                cantidad: cantidadEfectiva,
                aleatorio,
                titulo: modulo.corto || modulo.nombre,
                subtitulo:
                  submoduloId === 'todos'
                    ? 'Módulo completo'
                    : modulo.submodulos.find((s) => s.id === submoduloId)?.nombre,
              })
            }
          >
            {destino === 'estudio' ? 'Empezar a estudiar' : 'Empezar test'}
          </Boton>
        </div>
      </div>
    </div>
  );
}

function OpcionFila({ activa, titulo, detalle, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
        activa
          ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          activa ? 'border-sky-500 bg-sky-500' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {activa && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-slate-900 dark:text-white">{titulo}</span>
      </span>
      <Etiqueta>{detalle}</Etiqueta>
    </button>
  );
}
