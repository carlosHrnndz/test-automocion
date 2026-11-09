// Piezas de interfaz reutilizables con acabado de cuadro de instrumentos premium.

export function Boton({ children, variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tracking-tight ' +
    'transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer';
  const variantes = {
    primario:
      'bg-gradient-to-r from-sky-500 via-sky-500 to-indigo-500 text-white hover:from-sky-400 hover:via-sky-400 hover:to-indigo-400 ' +
      'shadow-lg shadow-sky-500/25 ring-1 ring-inset ring-white/25',
    secundario:
      'bg-white/90 text-slate-800 border border-slate-200/90 shadow-sm hover:bg-slate-100/90 hover:border-slate-300 ' +
      'dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700/80 dark:hover:bg-slate-700/90 dark:hover:border-slate-600',
    fantasma:
      'bg-transparent text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/70',
    peligro:
      'bg-gradient-to-r from-rose-600 to-orange-600 text-white hover:from-rose-500 hover:to-orange-500 shadow-lg shadow-rose-500/25 ring-1 ring-inset ring-white/20',
  };
  return (
    <button className={`${base} ${variantes[variante]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Cabecera({ titulo, subtitulo, alVolver, derecha }) {
  return (
    <header className="zonaSegura sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 shadow-xs backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {alVolver && (
          <button
            onClick={alVolver}
            aria-label="Volver"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-slate-100/80 active:scale-95 dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white">{titulo}</h1>
          {subtitulo && (
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{subtitulo}</p>
          )}
        </div>
        {derecha}
      </div>
    </header>
  );
}

export function Tarjeta({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/85 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-slate-800/85 dark:bg-slate-900/80 dark:shadow-black/25 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-3xl shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        {icono}
      </div>
      <h2 className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{titulo}</h2>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{texto}</p>
      {accion}
    </div>
  );
}

export function Barra({ valor, total, color = 'bg-sky-500' }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/85 p-[1px] shadow-inner dark:bg-slate-800/90">
      <div
        className={`h-full rounded-full ${color} transition-all duration-300`}
        style={{ width: `${pct}%`, boxShadow: pct > 0 ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none' }}
      />
    </div>
  );
}

export function Etiqueta({ children, color = 'slate' }) {
  const colores = {
    slate:
      'bg-slate-100/90 text-slate-700 ring-1 ring-inset ring-slate-300/60 dark:bg-slate-800/90 dark:text-slate-300 dark:ring-slate-700/70',
    verde:
      'bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
    rojo:
      'bg-rose-500/12 text-rose-700 ring-1 ring-inset ring-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25',
    ambar:
      'bg-amber-500/12 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
    azul:
      'bg-sky-500/12 text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/25',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${colores[color]}`}>
      {children}
    </span>
  );
}

export function Icono({ nombre, size = 20, className = '' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };
  const rutas = {
    play: <path d="M6 3l14 9-14 9V3z" />,
    casa: (
      <>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8" />
        <path d="M9.5 21v-6h5v6" />
      </>
    ),
    marcador: <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />,
    repaso: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" />,
    libro: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
    grafico: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l3-4 3 3 5-7" />
      </>
    ),
    ajustes: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    lista: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    izquierda: <path d="M15 18l-6-6 6-6" />,
    derecha: <path d="M9 18l6-6-6-6" />,
    check: <path d="M20 6L9 17l-5-5" />,
    cruz: <path d="M18 6L6 18M6 6l12 12" />,
    bombilla: (
      <>
        <path d="M9 18h6M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
      </>
    ),
    llave: (
      <>
        <path d="M14.7 6.3a5 5 0 1 0-6.4 6.4L3 18v3h3l5.3-5.3a5 5 0 0 0 3.4-9.4z" />
      </>
    ),
  };
  return <svg {...props}>{rutas[nombre] || null}</svg>;
}
