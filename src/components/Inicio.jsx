import { Boton, Icono, Tarjeta } from './ui.jsx';
import { TITULACION } from '../lib/estructura.js';
import { rutaDeArchivo } from '../lib/banco.js';

export default function Inicio({
  resumen,
  sesionGuardada,
  ir,
  alReanudar,
  alDescartarSesion,
  tema,
  alCambiarTema,
  alActualizar,
  actualizando = false,
}) {
  const acciones = [
    {
      id: 'configurar',
      icono: 'play',
      titulo: 'Nuevo test',
      texto: 'Elige módulo, tema y número de preguntas',
      color: 'text-sky-500 dark:text-sky-400',
      fondo: 'bg-gradient-to-br from-sky-500/20 to-indigo-500/15 ring-1 ring-inset ring-sky-500/30',
      bordeHover: 'enabled:hover:border-sky-400/70 dark:enabled:hover:border-sky-500/60',
    },
    {
      id: 'repaso',
      icono: 'repaso',
      titulo: 'Repasar fallos',
      texto:
        resumen.repaso > 0
          ? `${resumen.repaso} preguntas pendientes de dominar`
          : 'Todavía no tienes fallos registrados',
      color: 'text-rose-500 dark:text-rose-400',
      fondo: 'bg-gradient-to-br from-rose-500/20 to-orange-500/15 ring-1 ring-inset ring-rose-500/30',
      bordeHover: 'enabled:hover:border-rose-400/70 dark:enabled:hover:border-rose-500/60',
      contador: resumen.repaso,
      desactivada: resumen.repaso === 0,
    },
    {
      id: 'marcadas',
      icono: 'marcador',
      titulo: 'Marcadas para después',
      texto: resumen.marcadas > 0 ? `${resumen.marcadas} preguntas guardadas` : 'Marca preguntas durante el test',
      color: 'text-amber-500 dark:text-amber-400',
      fondo: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/15 ring-1 ring-inset ring-amber-500/30',
      bordeHover: 'enabled:hover:border-amber-400/70 dark:enabled:hover:border-amber-500/60',
      contador: resumen.marcadas,
      desactivada: resumen.marcadas === 0,
    },
    {
      id: 'estudio',
      icono: 'libro',
      titulo: 'Modo estudio',
      texto: 'Lee preguntas, respuestas y explicaciones deslizando',
      color: 'text-emerald-500 dark:text-emerald-400',
      fondo: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/15 ring-1 ring-inset ring-emerald-500/30',
      bordeHover: 'enabled:hover:border-emerald-400/70 dark:enabled:hover:border-emerald-500/60',
    },
    {
      id: 'estadisticas',
      icono: 'grafico',
      titulo: 'Estadísticas',
      texto: 'Tu progreso por módulo y tu historial',
      color: 'text-violet-500 dark:text-violet-400',
      fondo: 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/15 ring-1 ring-inset ring-violet-500/30',
      bordeHover: 'enabled:hover:border-violet-400/70 dark:enabled:hover:border-violet-500/60',
    },
    {
      id: 'ajustes',
      icono: 'ajustes',
      titulo: 'Ajustes',
      texto: 'Tema, avance automático, copia de seguridad',
      color: 'text-slate-600 dark:text-slate-300',
      fondo: 'bg-gradient-to-br from-slate-500/20 to-slate-400/10 ring-1 ring-inset ring-slate-500/25',
      bordeHover: 'enabled:hover:border-slate-400/70 dark:enabled:hover:border-slate-600',
    },
  ];

  return (
    <div className="min-h-dvh pb-16">
      <div className="zonaSegura mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
        {/* Cabecera Hero con emblema mecánico */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/85 bg-gradient-to-br from-white/95 via-white/90 to-sky-50/60 p-5 shadow-md backdrop-blur-xl dark:border-slate-800/90 dark:from-slate-900/95 dark:via-slate-900/85 dark:to-slate-950/90 dark:shadow-black/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
              <div className="relative shrink-0">
                <img
                  src={rutaDeArchivo('icono.svg')}
                  alt="Emblema Test de Mecánica"
                  className="h-14 w-14 rounded-2xl shadow-lg shadow-sky-500/20 ring-1 ring-white/20 sm:h-16 sm:w-16"
                  draggable={false}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
                  {TITULACION}
                </p>
                <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                  Test de Mecánica
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {alActualizar && (
                <button
                  onClick={alActualizar}
                  disabled={actualizando}
                  aria-label="Actualizar preguntas y aplicación"
                  title="Actualizar preguntas y aplicación"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-2xs transition hover:border-sky-400/60 hover:text-sky-500 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-sky-500/50 dark:hover:text-sky-400"
                >
                  <Icono nombre="repaso" size={19} className={actualizando ? 'animate-spin text-sky-500' : ''} />
                </button>
              )}
              <button
                onClick={alCambiarTema}
                aria-label="Cambiar tema"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-2xs transition hover:border-amber-400/60 hover:text-amber-500 active:scale-95 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-amber-400/50 dark:hover:text-amber-400"
              >
                {tema === 'oscuro' ? (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Resumen de telemetría */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <Dato valor={resumen.totalPreguntas} etiqueta="preguntas" acento="text-sky-600 dark:text-sky-400" />
            <Dato valor={resumen.vistas} etiqueta="practicadas" acento="text-indigo-600 dark:text-indigo-400" />
            <Dato valor={`${resumen.acierto}%`} etiqueta="acierto" acento="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {sesionGuardada && (
          <Tarjeta className="mt-4 border-sky-400/60 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-indigo-500/10 dark:border-sky-500/40 dark:from-sky-500/15 dark:via-slate-900/90 dark:to-indigo-500/15">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">Tienes un test a medias</p>
                <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {sesionGuardada.titulo} · pregunta {(sesionGuardada.indice ?? 0) + 1} de {sesionGuardada.ids.length}
                </p>
              </div>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sky-500 shadow-sm shadow-sky-400" />
            </div>
            <div className="mt-3.5 flex gap-2">
              <Boton onClick={alReanudar} className="flex-1">
                Continuar
              </Boton>
              <Boton variante="fantasma" onClick={alDescartarSesion}>
                Descartar
              </Boton>
            </div>
          </Tarjeta>
        )}

        {/* Acciones. En el ordenador van en dos columnas: si no, quedaban seis
            franjas de punta a punta con la mitad de la pantalla en blanco. */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {acciones.map((a) => (
            <button
              key={a.id}
              onClick={() => !a.desactivada && ir(a.id)}
              disabled={a.desactivada}
              className={`group flex items-center gap-3.5 rounded-2xl border border-slate-200/85 bg-white/90 p-4 text-left shadow-xs backdrop-blur-md transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md enabled:active:scale-[0.99] disabled:opacity-45 dark:border-slate-800/90 dark:bg-slate-900/80 dark:shadow-black/20 ${a.bordeHover}`}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-enabled:group-hover:scale-105 ${a.fondo} ${a.color}`}>
                <Icono nombre={a.icono} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {a.titulo}
                </span>
                <span className="mt-0.5 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {a.texto}
                </span>
              </span>
              {a.contador > 0 && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${a.fondo} ${a.color}`}>
                  {a.contador}
                </span>
              )}
              <Icono
                nombre="derecha"
                size={18}
                className="shrink-0 text-slate-300 transition-transform duration-200 group-enabled:group-hover:translate-x-0.5 dark:text-slate-600"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dato({ valor, etiqueta, acento }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-3 py-3 text-center shadow-2xs dark:border-slate-800/90 dark:bg-slate-950/65">
      <p className={`text-xl font-black tracking-tight sm:text-2xl ${acento || 'text-slate-900 dark:text-white'}`}>
        {valor}
      </p>
      <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {etiqueta}
      </p>
    </div>
  );
}
