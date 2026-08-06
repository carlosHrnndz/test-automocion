import { useCallback, useEffect, useMemo, useState } from 'react';
import Inicio from './components/Inicio.jsx';
import Configurador from './components/Configurador.jsx';
import Test from './components/Test.jsx';
import Estudio from './components/Estudio.jsx';
import Resultados from './components/Resultados.jsx';
import Estadisticas from './components/Estadisticas.jsx';
import AjustesPantalla from './components/Ajustes.jsx';
import { Boton, Vacio } from './components/ui.jsx';
import { cargarBanco, construirTest, filtrar, modulosConPreguntas } from './lib/banco.js';
import {
  ajustes as almacenAjustes,
  estadisticas,
  historial,
  marcadas as almacenMarcadas,
  necesitaRepaso,
  sesion as almacenSesion,
} from './lib/almacen.js';

const LIMITE_REPASO = 50;

export default function App() {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [vista, setVista] = useState('inicio');
  const [destinoConfig, setDestinoConfig] = useState('test');
  const [test, setTest] = useState(null);
  const [estudio, setEstudio] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ajustes, setAjustes] = useState(() => almacenAjustes.leer());
  const [sesionGuardada, setSesionGuardada] = useState(() => almacenSesion.leer());
  const [refresco, setRefresco] = useState(0);

  // Tema
  useEffect(() => {
    document.documentElement.classList.toggle('dark', ajustes.tema === 'oscuro');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', ajustes.tema === 'oscuro' ? '#020617' : '#f8fafc');
  }, [ajustes.tema]);

  // Carga del banco
  useEffect(() => {
    cargarBanco()
      .then((banco) => setEstado({ fase: 'listo', banco }))
      .catch((e) => setEstado({ fase: 'error', mensaje: e.message }));
  }, []);

  const banco = estado.banco;
  const modulos = useMemo(() => (banco ? modulosConPreguntas(banco) : []), [banco]);

  const cambiarAjustes = useCallback((parcial) => setAjustes(almacenAjustes.guardar(parcial)), []);

  const resumen = useMemo(() => {
    if (!banco) return { totalPreguntas: 0, vistas: 0, acierto: 0, repaso: 0, marcadas: 0 };
    const stats = estadisticas.todas();
    const guardadas = new Set(almacenMarcadas.todas());
    let vistas = 0;
    let aciertos = 0;
    let intentos = 0;
    let repaso = 0;
    let marcadasEnBanco = 0;
    for (const p of banco.preguntas) {
      if (guardadas.has(p.id)) marcadasEnBanco += 1;
      const e = stats[p.id];
      if (!e) continue;
      vistas += 1;
      aciertos += e.a;
      intentos += e.a + e.f;
      if (necesitaRepaso(e)) repaso += 1;
    }
    return {
      totalPreguntas: banco.preguntas.length,
      vistas,
      acierto: intentos ? Math.round((aciertos / intentos) * 100) : 0,
      repaso,
      marcadas: marcadasEnBanco,
    };
    // refresco fuerza el recálculo al volver de un test
  }, [banco, refresco]);

  // --- Lanzadores ----------------------------------------------------------

  function lanzarTest(preguntas, titulo, subtitulo, opciones = {}) {
    if (!preguntas.length) return;
    setTest({
      preguntas: construirTest(preguntas, {
        cantidad: 'todas',
        aleatorio: true,
        barajarOpciones: ajustes.barajarOpciones,
        ...opciones,
      }),
      titulo,
      subtitulo,
      sesionInicial: null,
    });
    setVista('test');
  }

  function desdeConfigurador(cfg) {
    const preguntas = filtrar(banco, cfg);
    const lista = construirTest(preguntas, {
      cantidad: cfg.cantidad,
      aleatorio: cfg.aleatorio,
      barajarOpciones: destinoConfig === 'test' ? ajustes.barajarOpciones : false,
    });
    if (destinoConfig === 'estudio') {
      setEstudio({ preguntas: lista, titulo: `${cfg.titulo} · ${cfg.subtitulo}` });
      setVista('estudio');
    } else {
      setTest({ preguntas: lista, titulo: cfg.titulo, subtitulo: cfg.subtitulo, sesionInicial: null });
      setVista('test');
    }
  }

  function ir(destino) {
    if (destino === 'configurar') {
      setDestinoConfig('test');
      setVista('configurar');
    } else if (destino === 'estudio') {
      setDestinoConfig('estudio');
      setVista('configurar');
    } else if (destino === 'repaso') {
      const stats = estadisticas.todas();
      const lista = banco.preguntas
        .filter((p) => necesitaRepaso(stats[p.id]))
        .sort((a, b) => (stats[b.id]?.f || 0) - (stats[a.id]?.f || 0))
        .slice(0, LIMITE_REPASO);
      lanzarTest(lista, 'Repaso de fallos', `${lista.length} preguntas que se te atragantan`);
    } else if (destino === 'marcadas') {
      const guardadas = new Set(almacenMarcadas.todas());
      const lista = banco.preguntas.filter((p) => guardadas.has(p.id));
      lanzarTest(lista, 'Preguntas marcadas', `${lista.length} guardadas para después`);
    } else {
      setVista(destino);
    }
  }

  function terminarTest(res) {
    historial.añadir({
      fecha: Date.now(),
      titulo: res.titulo,
      subtitulo: res.subtitulo,
      total: res.preguntas.length,
      aciertos: res.preguntas.reduce((n, p, i) => n + (res.respuestas[i] === p.correcta ? 1 : 0), 0),
      segundos: res.segundos,
    });
    almacenSesion.borrar();
    setSesionGuardada(null);
    setResultado(res);
    setRefresco((n) => n + 1);
    setVista('resultados');
  }

  function volverAlInicio() {
    setSesionGuardada(almacenSesion.leer());
    setRefresco((n) => n + 1);
    setVista('inicio');
  }

  function reanudar() {
    const s = almacenSesion.leer();
    if (!s || !banco) return;
    const porId = new Map(banco.preguntas.map((p) => [p.id, p]));
    let preguntas = s.ids.map((id) => porId.get(id)).filter(Boolean);
    if (preguntas.length !== s.ids.length) {
      alert('El banco de preguntas ha cambiado y no se puede reanudar este test.');
      almacenSesion.borrar();
      setSesionGuardada(null);
      return;
    }

    // Se recupera el orden de las opciones que tenías delante. Sin esto, al
    // continuar salían sin barajar y las respuestas ya dadas señalaban a la
    // opción equivocada. Las sesiones guardadas antes de este arreglo no traen
    // este dato: se reanudan como se pueda, con el orden del banco.
    if (Array.isArray(s.orden) && s.orden.length === preguntas.length) {
      preguntas = preguntas.map((p, i) => {
        const guardada = s.orden[i];
        if (!guardada || guardada.id !== p.id || !Array.isArray(guardada.opciones)) return p;
        return { ...p, opciones: guardada.opciones, correcta: guardada.correcta };
      });
    }
    setTest({
      preguntas,
      titulo: s.titulo,
      subtitulo: s.subtitulo,
      sesionInicial: { indice: s.indice, respuestas: s.respuestas, inicio: s.inicio },
    });
    setVista('test');
  }

  // --- Render --------------------------------------------------------------

  if (estado.fase === 'cargando') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500 dark:border-slate-700 dark:border-t-sky-500" />
      </div>
    );
  }

  if (estado.fase === 'error') {
    return (
      <Vacio
        icono="⚠️"
        titulo="No se pudieron cargar las preguntas"
        texto={estado.mensaje}
        accion={<Boton onClick={() => location.reload()}>Reintentar</Boton>}
      />
    );
  }

  if (!banco.preguntas.length) {
    return (
      <Vacio
        icono="📋"
        titulo="El banco está vacío"
        texto="Genera preguntas con el capturador (herramientas/capturador.html), exporta el JSON a public/data/ y vuelve a desplegar."
      />
    );
  }

  if (vista === 'test' && test) {
    return (
      <Test
        key={test.titulo + test.preguntas.length + (test.sesionInicial ? 'r' : 'n')}
        preguntas={test.preguntas}
        titulo={test.titulo}
        subtitulo={test.subtitulo}
        ajustes={ajustes}
        sesionInicial={test.sesionInicial}
        alSalir={volverAlInicio}
        alTerminar={terminarTest}
      />
    );
  }

  if (vista === 'estudio' && estudio) {
    return <Estudio preguntas={estudio.preguntas} titulo={estudio.titulo} alSalir={volverAlInicio} />;
  }

  if (vista === 'resultados' && resultado) {
    return (
      <Resultados
        resultado={resultado}
        alInicio={volverAlInicio}
        alRepetir={() => {
          setTest({ ...test, sesionInicial: null, preguntas: construirTest(test.preguntas, { cantidad: 'todas' }) });
          setVista('test');
        }}
        alRepetirFallos={(falladas) => lanzarTest(falladas, 'Repetir fallos', `${falladas.length} preguntas`)}
      />
    );
  }

  if (vista === 'configurar') {
    return (
      <Configurador
        banco={banco}
        modulos={modulos}
        destino={destinoConfig}
        alEmpezar={desdeConfigurador}
        alVolver={volverAlInicio}
      />
    );
  }

  if (vista === 'estadisticas') {
    return <Estadisticas banco={banco} modulos={modulos} alVolver={volverAlInicio} />;
  }

  if (vista === 'ajustes') {
    return (
      <AjustesPantalla
        ajustes={ajustes}
        alCambiar={cambiarAjustes}
        alVolver={volverAlInicio}
        totalPreguntas={banco.preguntas.length}
      />
    );
  }

  return (
    <Inicio
      resumen={resumen}
      sesionGuardada={sesionGuardada}
      ir={ir}
      alReanudar={reanudar}
      alDescartarSesion={() => {
        almacenSesion.borrar();
        setSesionGuardada(null);
      }}
      tema={ajustes.tema}
      alCambiarTema={() => cambiarAjustes({ tema: ajustes.tema === 'oscuro' ? 'claro' : 'oscuro' })}
    />
  );
}
