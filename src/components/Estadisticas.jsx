import { useMemo } from 'react';
import { Barra, Boton, Cabecera, Etiqueta, Tarjeta } from './ui.jsx';
import { estadisticas, historial, necesitaRepaso } from '../lib/almacen.js';
import { formatearTiempo } from './Resultados.jsx';

export default function Estadisticas({ banco, modulos, alVolver }) {
  const stats = estadisticas.todas();
  const registros = historial.todo();

  const porModulo = useMemo(
    () =>
      modulos.map((m) => {
        const preguntas = banco.porModulo[m.id] || [];
        let vistas = 0;
        let aciertos = 0;
        let intentos = 0;
        let pendientes = 0;
        for (const p of preguntas) {
          const e = stats[p.id];
          if (!e) continue;
          vistas += 1;
          aciertos += e.a;
          intentos += e.a + e.f;
          if (necesitaRepaso(e)) pendientes += 1;
        }
        return {
          ...m,
          vistas,
          pendientes,
          acierto: intentos ? Math.round((aciertos / intentos) * 100) : 0,
        };
      }),
    [banco, modulos, stats]
  );

  return (
    <div className="min-h-dvh pb-16">
      <Cabecera titulo="Estadísticas" subtitulo="Tu progreso" alVolver={alVolver} />
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5">
        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Por módulo
          </h2>
          {porModulo.map((m) => (
            <Tarjeta key={m.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-slate-900 dark:text-white">{m.nombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {m.vistas} de {m.total} preguntas practicadas
                  </p>
                </div>
                <Etiqueta color={m.acierto >= 70 ? 'verde' : m.acierto >= 50 ? 'ambar' : 'rojo'}>
                  {m.vistas ? `${m.acierto}%` : '—'}
                </Etiqueta>
              </div>
              <div className="mt-3">
                <Barra
                  valor={m.vistas}
                  total={m.total}
                  color={m.acierto >= 70 ? 'bg-emerald-500' : m.acierto >= 50 ? 'bg-amber-500' : 'bg-rose-500'}
                />
              </div>
              {m.pendientes > 0 && (
                <p className="mt-2 text-xs text-rose-500">{m.pendientes} pendientes de dominar</p>
              )}
            </Tarjeta>
          ))}
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Historial
            </h2>
            {registros.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('¿Borrar el historial de tests?')) {
                    historial.limpiar();
                    location.reload();
                  }
                }}
                className="text-xs font-semibold text-slate-400 hover:text-rose-500"
              >
                Borrar
              </button>
            )}
          </div>
          {registros.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Todavía no has terminado ningún test.</p>
          ) : (
            registros.slice(0, 30).map((r, i) => {
              const nota = r.total ? (r.aciertos / r.total) * 10 : 0;
              return (
                <Tarjeta key={i} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      nota >= 5
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {nota.toFixed(1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.titulo}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {r.subtitulo ? r.subtitulo + ' · ' : ''}
                      {r.aciertos}/{r.total} · {formatearTiempo(r.segundos)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(r.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </Tarjeta>
              );
            })
          )}
        </section>

        <Boton
          variante="fantasma"
          onClick={() => {
            if (confirm('Esto borra aciertos, fallos y rachas de todas las preguntas. ¿Seguro?')) {
              estadisticas.reiniciar();
              location.reload();
            }
          }}
        >
          Reiniciar todo el progreso
        </Boton>
      </div>
    </div>
  );
}
