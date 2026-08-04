import { useState } from 'react';
import TarjetaPregunta from './TarjetaPregunta.jsx';
import { Boton, Cabecera, Etiqueta, Tarjeta } from './ui.jsx';

export default function Resultados({ resultado, alInicio, alRepetirFallos, alRepetir }) {
  const [ver, setVer] = useState(null); // null | 'falladas' | 'todas'
  const { preguntas, respuestas, titulo, subtitulo, segundos } = resultado;

  const total = preguntas.length;
  const aciertos = preguntas.reduce((n, p, i) => n + (respuestas[i] === p.correcta ? 1 : 0), 0);
  const sinResponder = preguntas.reduce((n, _, i) => n + (respuestas[i] === undefined ? 1 : 0), 0);
  const fallos = total - aciertos - sinResponder;
  const nota = total > 0 ? (aciertos / total) * 10 : 0;
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;

  const aprobado = nota >= 5;
  const mensaje = nota >= 9 ? 'Excelente' : nota >= 7 ? 'Muy bien' : aprobado ? 'Aprobado' : 'A repasar';

  const falladas = preguntas
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => respuestas[i] !== undefined && respuestas[i] !== p.correcta);

  const listaVisible =
    ver === 'falladas' ? falladas : ver === 'todas' ? preguntas.map((p, i) => ({ p, i })) : [];

  if (ver) {
    return (
      <div className="min-h-dvh pb-16">
        <Cabecera
          titulo={ver === 'falladas' ? 'Preguntas falladas' : 'Todas las preguntas'}
          subtitulo={`${listaVisible.length} preguntas`}
          alVolver={() => setVer(null)}
        />
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
          {listaVisible.map(({ p, i }) => (
            <Tarjeta key={p.id + i}>
              <TarjetaPregunta
                pregunta={p}
                seleccionada={respuestas[i] ?? -1}
                modo="estudio"
                numero={i + 1}
                total={total}
              />
            </Tarjeta>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      <Cabecera titulo="Resultado" subtitulo={subtitulo || titulo} alVolver={alInicio} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <Tarjeta className="flex flex-col items-center gap-3 py-8 text-center">
          <Anillo pct={pct} aprobado={aprobado} />
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{nota.toFixed(1)}</p>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{mensaje}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Etiqueta color="verde">{aciertos} aciertos</Etiqueta>
            {fallos > 0 && <Etiqueta color="rojo">{fallos} fallos</Etiqueta>}
            {sinResponder > 0 && <Etiqueta color="ambar">{sinResponder} en blanco</Etiqueta>}
            <Etiqueta>{formatearTiempo(segundos)}</Etiqueta>
          </div>
        </Tarjeta>

        <div className="grid gap-2 sm:grid-cols-2">
          {falladas.length > 0 && (
            <Boton variante="secundario" onClick={() => setVer('falladas')}>
              Revisar los {falladas.length} fallos
            </Boton>
          )}
          <Boton variante="secundario" onClick={() => setVer('todas')}>
            Ver todas las preguntas
          </Boton>
          {falladas.length > 0 && (
            <Boton onClick={() => alRepetirFallos(falladas.map(({ p }) => p))}>
              Repetir sólo los fallos
            </Boton>
          )}
          <Boton variante="secundario" onClick={alRepetir}>
            Repetir el mismo test
          </Boton>
          <Boton variante="fantasma" onClick={alInicio} className="sm:col-span-2">
            Volver al inicio
          </Boton>
        </div>
      </div>
    </div>
  );
}

function Anillo({ pct, aprobado }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={aprobado ? 'stroke-emerald-500' : 'stroke-rose-500'}
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{pct}%</span>
      </div>
    </div>
  );
}

export function formatearTiempo(s) {
  if (!s && s !== 0) return '';
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return m > 0 ? `${m} min ${seg}s` : `${seg}s`;
}
