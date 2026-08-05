import { LETRAS } from '../lib/banco.js';
import { Etiqueta, Icono } from './ui.jsx';

/**
 * Tarjeta de una pregunta.
 *
 * modo = 'test'    -> las opciones son pulsables; el color aparece al responder.
 * modo = 'estudio' -> la correcta ya viene marcada en verde y se ve todo.
 */
export default function TarjetaPregunta({
  pregunta,
  seleccionada = null,
  modo = 'test',
  alResponder,
  marcada = false,
  alMarcar,
  numero,
  total,
}) {
  const revelada = modo === 'estudio' || seleccionada !== null;

  function claseOpcion(i) {
    const base =
      'group flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left text-[15px] leading-snug transition';
    if (!revelada) {
      return `${base} border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500 dark:hover:bg-sky-500/10`;
    }
    if (i === pregunta.correcta) {
      return `${base} border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-500/15`;
    }
    if (i === seleccionada) {
      return `${base} border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-500/15`;
    }
    return `${base} border-slate-200 bg-white opacity-55 dark:border-slate-800 dark:bg-slate-900`;
  }

  function claseLetra(i) {
    const base =
      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold';
    if (!revelada) return `${base} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`;
    if (i === pregunta.correcta) return `${base} bg-emerald-500 text-white`;
    if (i === seleccionada) return `${base} bg-rose-500 text-white`;
    return `${base} bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {numero != null && (
            <Etiqueta color="azul">
              {numero} / {total}
            </Etiqueta>
          )}
          {pregunta.submodulo && <Etiqueta>{pregunta.submodulo}</Etiqueta>}
        </div>
        {alMarcar && (
          <button
            onClick={alMarcar}
            aria-label={marcada ? 'Quitar marca' : 'Marcar para después'}
            aria-pressed={marcada}
            className={`shrink-0 rounded-lg p-2 transition ${
              marcada
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={marcada ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Enunciado */}
      <h2 className="text-lg font-semibold leading-snug text-slate-900 dark:text-white sm:text-xl">
        {pregunta.pregunta}
      </h2>

      {pregunta.imagen && (
        <img
          src={pregunta.imagen}
          alt=""
          className="max-h-64 w-full rounded-xl object-contain"
          draggable={false}
        />
      )}

      {/* Opciones */}
      <div className="flex flex-col gap-2.5">
        {pregunta.opciones.map((op, i) => (
          <button
            key={i}
            type="button"
            disabled={revelada}
            onClick={() => alResponder?.(i)}
            className={claseOpcion(i)}
          >
            <span className={claseLetra(i)}>{LETRAS[i]}</span>
            <span className="flex-1 text-slate-800 dark:text-slate-100">{op}</span>
            {revelada && i === pregunta.correcta && (
              <Icono nombre="check" size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            {revelada && i === seleccionada && i !== pregunta.correcta && (
              <Icono nombre="cruz" size={18} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
          </button>
        ))}
      </div>

      {/* Explicación y ejemplo.
          Sin data-sin-swipe a propósito: después de responder ocupa media
          pantalla, y es justo cuando quieres deslizar a la siguiente. */}
      {revelada && (pregunta.explicacion || pregunta.ejemplo) && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          {pregunta.explicacion && (
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                <Icono nombre="bombilla" size={15} />
                Por qué
                {pregunta.revisado === false && (
                  <span
                    title="Generada automáticamente y todavía sin contrastar. Comprueba los datos antes de darla por buena."
                    className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                  >
                    sin revisar
                  </span>
                )}
              </div>
              <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {pregunta.explicacion}
              </p>
            </div>
          )}

          {pregunta.ejemplo && (
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <Icono nombre="llave" size={15} />
                Ejemplo
              </div>
              <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {pregunta.ejemplo}
              </p>
            </div>
          )}

          <EnlacesMaterial material={pregunta.material} />
        </div>
      )}
    </div>
  );
}

function EnlacesMaterial({ material }) {
  if (!material) return null;
  const enlaces = [];
  if (material.pdf) {
    enlaces.push({
      texto: material.pagina ? `PDF · pág. ${material.pagina}` : 'PDF de teoría',
      url: material.pagina ? `${material.pdf}#page=${material.pagina}` : material.pdf,
    });
  }
  if (material.video) {
    enlaces.push({ texto: material.minuto ? `Vídeo · ${material.minuto}` : 'Vídeo', url: material.video });
  }
  if (material.audio) enlaces.push({ texto: 'Audio', url: material.audio });
  if (!enlaces.length) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      {enlaces.map((e) => (
        <a
          key={e.url}
          href={e.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {e.texto}
        </a>
      ))}
    </div>
  );
}
