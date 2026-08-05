// Piezas de interfaz reutilizables.

export function Boton({ children, variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
    'transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none';
  const variantes = {
    primario: 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20',
    secundario:
      'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    fantasma:
      'bg-transparent text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800',
    peligro: 'bg-rose-600 text-white hover:bg-rose-500',
  };
  return (
    <button className={`${base} ${variantes[variante]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Cabecera({ titulo, subtitulo, alVolver, derecha }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {alVolver && (
          <button
            onClick={alVolver}
            aria-label="Volver"
            className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-slate-900 dark:text-white">{titulo}</h1>
          {subtitulo && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
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
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-4xl opacity-60">{icono}</div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{texto}</p>
      {accion}
    </div>
  );
}

export function Barra({ valor, total, color = 'bg-sky-500' }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Etiqueta({ children, color = 'slate' }) {
  const colores = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    verde: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    rojo: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    ambar: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    azul: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${colores[color]}`}>
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
