import { Boton, Icono, Tarjeta } from './ui.jsx';
import { TITULACION } from '../lib/estructura.js';

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
      color: 'text-sky-500',
      fondo: 'bg-sky-500/10',
    },
    {
      id: 'repaso',
      icono: 'repaso',
      titulo: 'Repasar fallos',
      texto:
        resumen.repaso > 0
          ? `${resumen.repaso} preguntas pendientes de dominar`
          : 'Todavía no tienes fallos registrados',
      color: 'text-rose-500',
      fondo: 'bg-rose-500/10',
      contador: resumen.repaso,
      desactivada: resumen.repaso === 0,
    },
    {
      id: 'marcadas',
      icono: 'marcador',
      titulo: 'Marcadas para después',
      texto: resumen.marcadas > 0 ? `${resumen.marcadas} preguntas guardadas` : 'Marca preguntas durante el test',
      color: 'text-amber-500',
      fondo: 'bg-amber-500/10',
      contador: resumen.marcadas,
      desactivada: resumen.marcadas === 0,
    },
    {
      id: 'estudio',
      icono: 'libro',
      titulo: 'Modo estudio',
      texto: 'Lee preguntas, respuestas y explicaciones deslizando',
      color: 'text-emerald-500',
      fondo: 'bg-emerald-500/10',
    },
    {
      id: 'estadisticas',
      icono: 'grafico',
      titulo: 'Estadísticas',
      texto: 'Tu progreso por módulo y tu historial',
      color: 'text-violet-500',
      fondo: 'bg-violet-500/10',
    },
    {
      id: 'ajustes',
      icono: 'ajustes',
      titulo: 'Ajustes',
      texto: 'Tema, avance automático, copia de seguridad',
      color: 'text-slate-500',
      fondo: 'bg-slate-500/10',
    },
  ];

  return (
    <div className="min-h-dvh pb-16">
      <div className="zonaSegura mx-auto max-w-5xl px-4 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-500">{TITULACION}</p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-slate-900 dark:text-white">
              Test de Mecánica
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {alActualizar && (
              <button
                onClick={alActualizar}
                disabled={actualizando}
                aria-label="Actualizar preguntas y aplicación"
                title="Actualizar preguntas y aplicación"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icono nombre="repaso" size={20} className={actualizando ? 'animate-spin text-sky-500' : ''} />
              </button>
            )}
            <button
              onClick={alCambiarTema}
              aria-label="Cambiar tema"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {tema === 'oscuro' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Dato valor={resumen.totalPreguntas} etiqueta="preguntas" />
          <Dato valor={resumen.vistas} etiqueta="practicadas" />
          <Dato valor={`${resumen.acierto}%`} etiqueta="acierto" />
        </div>

        {sesionGuardada && (
          <Tarjeta className="mt-4 border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Tienes un test a medias</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {sesionGuardada.titulo} · pregunta {(sesionGuardada.indice ?? 0) + 1} de {sesionGuardada.ids.length}
            </p>
            <div className="mt-3 flex gap-2">
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
        <div className="mt-4 grid gap-2.5 md:grid-cols-2">
          {acciones.map((a) => (
            <button
              key={a.id}
              onClick={() => !a.desactivada && ir(a.id)}
              disabled={a.desactivada}
              className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left transition enabled:hover:border-slate-300 enabled:active:scale-[0.99] disabled:opacity-45 dark:border-slate-800 dark:bg-slate-900 dark:enabled:hover:border-slate-700"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.fondo} ${a.color}`}>
                <Icono nombre={a.icono} size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-900 dark:text-white">{a.titulo}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{a.texto}</span>
              </span>
              {a.contador > 0 && (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${a.fondo} ${a.color}`}>
                  {a.contador}
                </span>
              )}
              <Icono nombre="derecha" size={18} className="shrink-0 text-slate-300 dark:text-slate-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dato({ valor, etiqueta }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xl font-black text-slate-900 dark:text-white">{valor}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</p>
    </div>
  );
}
