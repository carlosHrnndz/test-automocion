import { useRef } from 'react';
import { Boton, Cabecera, Tarjeta } from './ui.jsx';
import { exportarProgreso, importarProgreso } from '../lib/almacen.js';

export default function Ajustes({ ajustes, alCambiar, alVolver, totalPreguntas }) {
  const inputRef = useRef(null);

  function descargar() {
    const datos = exportarProgreso();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progreso-automocion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function subir(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      importarProgreso(JSON.parse(await archivo.text()));
      alert('Progreso restaurado. Se recargará la app.');
      location.reload();
    } catch (err) {
      alert('No se pudo leer el archivo: ' + err.message);
    }
  }

  return (
    <div className="min-h-dvh pb-16">
      <Cabecera titulo="Ajustes" alVolver={alVolver} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5">
        <Tarjeta className="flex flex-col divide-y divide-slate-200 p-0 dark:divide-slate-800">
          <Interruptor
            titulo="Tema oscuro"
            texto="Más cómodo para estudiar de noche"
            activo={ajustes.tema === 'oscuro'}
            alCambiar={(v) => alCambiar({ tema: v ? 'oscuro' : 'claro' })}
          />
          <Interruptor
            titulo="Avance automático"
            texto="Pasa sola a la siguiente pregunta cuando aciertas"
            activo={ajustes.avanceAutomatico}
            alCambiar={(v) => alCambiar({ avanceAutomatico: v })}
          />
          <Interruptor
            titulo="Barajar las opciones"
            texto="Evita que memorices la posición de la respuesta"
            activo={ajustes.barajarOpciones}
            alCambiar={(v) => alCambiar({ barajarOpciones: v })}
          />
        </Tarjeta>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Copia de seguridad
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tu progreso se guarda solo en este navegador. Si cambias de móvil o borras los datos del
            navegador, lo pierdes. Descarga una copia de vez en cuando.
          </p>
          <div className="mt-1 flex gap-2">
            <Boton variante="secundario" onClick={descargar} className="flex-1">
              Descargar progreso
            </Boton>
            <Boton variante="secundario" onClick={() => inputRef.current?.click()} className="flex-1">
              Restaurar copia
            </Boton>
          </div>
          <input ref={inputRef} type="file" accept="application/json" onChange={subir} className="hidden" />
        </section>

        <p className="pt-4 text-center text-xs text-slate-400 dark:text-slate-600">
          {totalPreguntas} preguntas en el banco · Técnico Superior en Automoción
        </p>
      </div>
    </div>
  );
}

function Interruptor({ titulo, texto, activo, alCambiar }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{titulo}</span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{texto}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => alCambiar(!activo)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          activo ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            activo ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}
