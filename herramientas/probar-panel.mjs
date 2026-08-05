// Pruebas de la API del panel, arrancando el servidor de verdad.
// Uso:  node herramientas/probar-panel.mjs
//
// Trabaja sobre una copia del banco y la restaura al terminar: no toca tus datos.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, 'public', 'data');
const RESPALDO = path.join(os.tmpdir(), `data-respaldo-${process.pid}`);
const PUERTO = 5199;
const base = `http://127.0.0.1:${PUERTO}`;

const fallos = [];
function ok(nombre, cond) {
  console.log((cond ? '  OK   ' : '  FALLO') + ' ' + nombre);
  if (!cond) fallos.push(nombre);
}

const api = async (ruta, opciones = {}) => {
  const r = await fetch(base + ruta, {
    headers: { 'content-type': 'application/json' },
    ...opciones,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  return r.json();
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Respaldo del banco ----------------------------------------------------
fs.cpSync(DATOS, RESPALDO, { recursive: true });
const restaurar = () => {
  fs.rmSync(DATOS, { recursive: true, force: true });
  fs.cpSync(RESPALDO, DATOS, { recursive: true });
  fs.rmSync(RESPALDO, { recursive: true, force: true });
};

// --- Carpeta de capturas de prueba -----------------------------------------
const CAPTURAS = path.join(os.tmpdir(), `capturas-${process.pid}`);
const tema = path.join(CAPTURAS, 'CIRCUITOS DE FLUIDOS SUPENSION Y DIRECCION', 'SISTEMAS MECANICOS');
fs.mkdirSync(tema, { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'herramientas', 'ejemplo', 'captura-ejemplo.png'), path.join(tema, '001.png'));
fs.copyFileSync(path.join(RAIZ, 'herramientas', 'ejemplo', 'temario-ejemplo.pdf'), path.join(tema, 'temario.pdf'));

// --- Arrancar el servidor ---------------------------------------------------
const servidor = spawn(process.execPath, ['panel/servidor.mjs'], {
  cwd: RAIZ,
  env: { ...process.env, PUERTO: String(PUERTO), SIN_ABRIR: '1' },
  stdio: 'ignore',
});

const cerrar = (codigo) => {
  servidor.kill('SIGTERM');
  restaurar();
  fs.rmSync(CAPTURAS, { recursive: true, force: true });
  process.exit(codigo);
};
process.on('uncaughtException', (e) => { console.error(e); cerrar(1); });

// Esperamos a que responda
let vivo = false;
for (let i = 0; i < 40 && !vivo; i++) {
  await esperar(150);
  try { await fetch(base + '/api/estado'); vivo = true; } catch { /* aún no */ }
}
if (!vivo) { console.log('  FALLO el servidor no ha arrancado'); cerrar(1); }

try {
  console.log('--- Estado ---');
  const estado = await api('/api/estado');
  ok('responde con el estado', !!estado.banco);
  ok('lista los 10 modulos del temario', estado.modulos.length === 10);
  ok('informa de tesseract', typeof estado.tesseract.ok === 'boolean');
  ok('informa de ollama sin romperse si esta cerrado', typeof estado.ollama.ok === 'boolean');
  ok('informa de git', typeof estado.git.esRepo === 'boolean');
  ok('propone la carpeta de inicio', typeof estado.inicio === 'string');

  console.log('\n--- La interfaz se sirve ---');
  const html = await (await fetch(base + '/')).text();
  ok('sirve la pagina del panel', html.includes('Panel de Test de Mecánica'));

  console.log('\n--- Explorador de carpetas ---');
  const raiz = await api('/api/explorar?ruta=' + encodeURIComponent(CAPTURAS));
  ok('detecta el nivel raiz', raiz.nivel === 'raiz');
  ok('cuenta las imagenes de dentro', raiz.totalImagenes === 1);
  ok('lista la carpeta de modulo', raiz.carpetas.length === 1);

  const mod = await api('/api/explorar?ruta=' + encodeURIComponent(raiz.carpetas[0].ruta));
  ok('detecta el nivel modulo', mod.nivel === 'modulo');
  ok('ve el PDF del tema', mod.carpetas[0].pdfs === 1);

  const t = await api('/api/explorar?ruta=' + encodeURIComponent(mod.carpetas[0].ruta));
  ok('detecta el nivel tema', t.nivel === 'tema');
  ok('permite subir', !!t.padre);

  const malo = await api('/api/explorar?ruta=/no/existe/nada');
  ok('avisa si la carpeta no existe', !!malo.error);

  console.log('\n--- Importar desde el panel ---');
  const inicio = await api('/api/importar', { method: 'POST', cuerpo: { carpeta: CAPTURAS, sinIa: true, limpiar: true, motor: 'ocr' } });
  ok('acepta la orden de importar', inicio.ok === true);

  const segunda = await api('/api/importar', { method: 'POST', cuerpo: { carpeta: CAPTURAS } });
  ok('rechaza dos tareas a la vez', !!segunda.error);

  let terminado = false;
  for (let i = 0; i < 100 && !terminado; i++) {
    await esperar(200);
    const e = await api('/api/estado');
    terminado = e.tarea?.terminado;
  }
  ok('la importacion termina', terminado);

  const trasImportar = await api('/api/estado');
  if (trasImportar.tarea?.codigo !== 0) {
    // Casi siempre es que falta el español de Tesseract: lo enseñamos en claro.
    const log = await (await fetch(base + '/api/estado')).json();
    console.log('        (el importador ha terminado con código ' + log.tarea?.codigo + ')');
  }
  ok('termina sin errores', trasImportar.tarea?.codigo === 0);
  ok('el banco queda con 1 pregunta', trasImportar.banco.total === 1);
  ok('recuerda la carpeta usada', trasImportar.ajustes.carpetasRecientes.includes(CAPTURAS));

  console.log('\n--- Banco desde el panel ---');
  const { preguntas } = await api('/api/preguntas');
  ok('devuelve las preguntas', preguntas.length === 1);
  const p = preguntas[0];
  ok('trae el identificador de la academia', p.idExterno === '2778097');
  ok('trae la correcta detectada por el verde', p.correcta === 3);
  ok('guarda de que captura salio', p.origen === '001.png');

  const editada = await api('/api/pregunta', {
    method: 'PUT',
    cuerpo: { ...p, explicacion: 'Explicación corregida a mano.', revisado: true },
  });
  ok('guarda los cambios de una pregunta', editada.pregunta.revisado === true);
  const recargada = (await api('/api/preguntas')).preguntas[0];
  ok('los cambios persisten en el archivo', recargada.explicacion === 'Explicación corregida a mano.');

  console.log('\n--- Pegar texto desde el panel ---');
  const analisis = await api('/api/analizar', {
    method: 'POST',
    cuerpo: { texto: 'PREGUNTA: (Identificador nº 999)\n¿Prueba del panel?\nRespuestas\nuno\ndos*\ntres\ncuatro' },
  });
  ok('analiza el texto pegado', analisis.preguntas.length === 1);
  ok('detecta la correcta del texto', analisis.preguntas[0].correcta === 1);

  const anadido = await api('/api/anadir', {
    method: 'POST',
    cuerpo: { moduloId: 'mot', submodulo: 'CICLO OTTO', preguntas: analisis.preguntas },
  });
  ok('anade la pregunta al banco', anadido.anadidas === 1);

  const repetido = await api('/api/anadir', {
    method: 'POST',
    cuerpo: { moduloId: 'mot', submodulo: 'CICLO OTTO', preguntas: analisis.preguntas },
  });
  ok('no la anade dos veces', repetido.anadidas === 0);

  const conDos = await api('/api/estado');
  ok('el resumen cuenta los dos modulos', conDos.banco.porModulo.length === 2);

  console.log('\n--- Borrar ---');
  const todas = (await api('/api/preguntas')).preguntas;
  const borrado = await api('/api/borrar', { method: 'POST', cuerpo: { ids: todas.map((x) => x.id) } });
  ok('borra en bloque', borrado.borradas === todas.length);
  ok('el banco queda vacio', (await api('/api/estado')).banco.total === 0);

  const manifiesto = JSON.parse(fs.readFileSync(path.join(DATOS, 'manifest.json'), 'utf8'));
  ok('el manifiesto se queda sin modulos', manifiesto.modulos.length === 0);



  console.log('\n--- Pegar JSON de un modelo de vision ---');
  {
    // Los modelos pequeños devuelven el JSON sucio: con ```json, con "Aquí tienes"
    // delante, o con un bloque <think>. Todo eso tiene que colarse igual.
    const sucio = `<think>vale, veo la imagen</think>
Aquí tienes el resultado:
\`\`\`json
{"idExterno":"nº 5551","pregunta":"¿Prueba desde un modelo de vision?",
 "opciones":["alfa","beta","gamma","delta"],"correcta":2,
 "explicacion":"Porque si.","ejemplo":"Un caso.","confianza":"alta","dudas":""}
\`\`\``;
    const r = await api('/api/pegar-json', {
      method: 'POST', cuerpo: { texto: sucio, moduloId: 'stf', submodulo: 'EMBRAGUE' },
    });
    ok('lee JSON con markdown y texto alrededor', r.anadidas === 1);

    const guardada = (await api('/api/preguntas')).preguntas.find((p) => p.moduloId === 'stf');
    ok('limpia el identificador', guardada?.idExterno === '5551');
    ok('respeta la correcta', guardada?.correcta === 2);
    ok('aplica el modulo y el tema indicados', guardada?.submodulo === 'EMBRAGUE');
    ok('entra marcada como sin revisar', guardada?.revisado === false);
    ok('deja constancia del origen', guardada?.origen === 'modelo de visión');

    // Varias preguntas en un array
    const varias = JSON.stringify([
      { pregunta: '¿Una?', opciones: ['a', 'b'], correcta: 0 },
      { pregunta: '¿Dos?', opciones: ['c', 'd'], correcta: 1 },
    ]);
    const r2 = await api('/api/pegar-json', { method: 'POST', cuerpo: { texto: varias, moduloId: 'mot', submodulo: 'CICLOS' } });
    ok('acepta varias preguntas de golpe', r2.anadidas === 2);

    // Dos objetos seguidos sin corchetes, que es lo que suelen soltar
    const pegados = '{"pregunta":"¿Tres?","opciones":["e","f"],"correcta":0}\n{"pregunta":"¿Cuatro?","opciones":["g","h"],"correcta":1}';
    const r3 = await api('/api/pegar-json', { method: 'POST', cuerpo: { texto: pegados, moduloId: 'mot', submodulo: 'CICLOS' } });
    ok('acepta objetos sueltos sin corchetes', r3.anadidas === 2);

    // Ahora los casos malos: no deben entrar en silencio
    const malo = await api('/api/pegar-json', {
      method: 'POST',
      cuerpo: { texto: '{"pregunta":"¿Sin opciones?","opciones":["sola"],"correcta":0}', moduloId: 'mot' },
    });
    ok('rechaza una pregunta con una sola opcion', malo.anadidas === 0 && malo.problemas.length > 0);

    const fuera = await api('/api/pegar-json', {
      method: 'POST',
      cuerpo: { texto: '{"pregunta":"¿Correcta imposible?","opciones":["a","b"],"correcta":7}', moduloId: 'mot' },
    });
    ok('rechaza una correcta que no existe', fuera.anadidas === 0);

    const dudoso = await api('/api/pegar-json', {
      method: 'POST',
      cuerpo: { texto: '{"pregunta":"¿Dudosa?","opciones":["a","b","c"],"correcta":null,"confianza":"baja","dudas":"borroso"}', moduloId: 'mot', submodulo: 'CICLOS' },
    });
    ok('avisa de la confianza baja', dudoso.problemas.some((p) => /baja/.test(p)));
    ok('avisa de que no hay correcta', dudoso.problemas.some((p) => /correcta/i.test(p)));

    const ilegible = await api('/api/pegar-json', {
      method: 'POST',
      cuerpo: { texto: '{"pregunta":"¿Con [ILEGIBLE] dentro?","opciones":["a","b","c"],"correcta":0}', moduloId: 'mot', submodulo: 'CICLOS' },
    });
    ok('avisa de partes ilegibles', ilegible.problemas.some((p) => /ilegible/i.test(p)));

    const basura = await api('/api/pegar-json', { method: 'POST', cuerpo: { texto: 'no tengo ni idea', moduloId: 'mot' } });
    ok('avisa si no hay JSON', !!basura.error);

    // Limpiamos lo metido en esta prueba
    const todas = (await api('/api/preguntas')).preguntas;
    await api('/api/borrar', { method: 'POST', cuerpo: { ids: todas.map((x) => x.id) } });
  }

  console.log('\n--- Poner el tema a posteriori ---');
  {
    // Es lo que pasa cuando se pegan preguntas a mano y se olvida el tema:
    // quedan en "Sin clasificar" y desde la app no hay forma de filtrarlas.
    const sinTema = await api('/api/analizar', {
      method: 'POST',
      cuerpo: { texto: 'PREGUNTA: (Identificador nº 8801)\n¿Sin tema?\nRespuestas\nuno*\ndos\ntres' },
    });
    await api('/api/anadir', { method: 'POST', cuerpo: { moduloId: 'mot', preguntas: sinTema.preguntas } });

    const antes = (await api('/api/preguntas')).preguntas
      .find((p) => p.idExterno === '8801');
    ok('sin tema entra como Sin clasificar', antes?.submodulo === 'Sin clasificar');

    const r = await api('/api/reclasificar', {
      method: 'POST',
      cuerpo: { ids: [antes.id], submodulo: 'CICLO DIÉSEL' },
    });
    ok('reclasifica las seleccionadas', r.cambiadas === 1);

    const despues = (await api('/api/preguntas')).preguntas.find((p) => p.id === antes.id);
    ok('guarda el nombre del tema', despues.submodulo === 'CICLO DIÉSEL');
    ok('guarda tambien el identificador del tema', despues.submoduloId === 'ciclo-diesel');
    ok('no toca el modulo', despues.moduloId === antes.moduloId);
    ok('no toca el enunciado', despues.pregunta === antes.pregunta);

    const vacio = await api('/api/reclasificar', { method: 'POST', cuerpo: { ids: [antes.id], submodulo: '  ' } });
    ok('no acepta un tema vacio', !!vacio.error);
    const sinIds = await api('/api/reclasificar', { method: 'POST', cuerpo: { ids: [], submodulo: 'RUEDAS' } });
    ok('no acepta una seleccion vacia', !!sinIds.error);

    // La interfaz necesita saber los temas de cada módulo para sugerirlos.
    const est = await api('/api/estado');
    const cfsd = est.modulos.find((m) => m.id === 'cfsd');
    ok('el estado trae los temas del temario', (cfsd?.submodulos || []).includes('RUEDAS'));

    const pagina = await (await fetch(base + '/')).text();
    ok('la interfaz ofrece poner el tema', /id="btnTemaSel"/.test(pagina));
    ok('y deja filtrar las que no lo tienen', /value="sin-tema"/.test(pagina));
    ok('ofrece marcar revisadas en bloque', /id="btnRevisarSel"/.test(pagina));
    ok('el banco va a dos columnas', /class="banco2col"/.test(pagina));
    ok('el editor queda fijo al lado', /\.columnaEditor\{position:sticky/.test(pagina));
  }

  console.log('\n--- Dar por buenas varias explicaciones ---');
  {
    const conExplicacion = await api('/api/analizar', {
      method: 'POST',
      cuerpo: { texto: 'PREGUNTA: (Identificador nº 8802)\n¿Con explicacion?\nRespuestas\nuno*\ndos\ntres' },
    });
    conExplicacion.preguntas[0].explicacion = 'Porque si.';
    await api('/api/anadir', {
      method: 'POST',
      cuerpo: { moduloId: 'mot', submodulo: 'CICLO OTTO', preguntas: conExplicacion.preguntas },
    });

    const todas = (await api('/api/preguntas')).preguntas;
    const conTexto = todas.find((p) => p.idExterno === '8802');
    const sinTexto = todas.find((p) => p.idExterno === '8801');
    ok('la nueva entra sin revisar', conTexto?.revisado === false);

    const r = await api('/api/revisadas', {
      method: 'POST',
      cuerpo: { ids: [conTexto.id, sinTexto.id] },
    });
    ok('marca la que tiene explicacion', r.cambiadas === 1);
    ok('deja fuera la que no la tiene', r.sinExplicacion === 1);

    const despues = (await api('/api/preguntas')).preguntas;
    ok('queda revisada', despues.find((p) => p.id === conTexto.id).revisado === true);
    ok('la vacia sigue sin revisar', despues.find((p) => p.id === sinTexto.id).revisado === false);

    const sinIds = await api('/api/revisadas', { method: 'POST', cuerpo: { ids: [] } });
    ok('no acepta una seleccion vacia', !!sinIds.error);

    const atras = await api('/api/revisadas', {
      method: 'POST', cuerpo: { ids: [conTexto.id], revisado: false },
    });
    ok('tambien se puede deshacer', atras.cambiadas === 1);
  }

  console.log('\n--- Primera publicacion ---');
  {
    const est = await api('/api/estado');
    ok('dice si git sabe quien eres', 'identidad' in est.git);
    ok('dice si esta la herramienta de GitHub', typeof est.git.gh === 'boolean');
    ok('trae el nombre de la carpeta para sugerir el del repositorio', !!est.git.carpeta);

    // La dirección del repositorio se valida antes de tocar nada: un remoto mal
    // puesto deja el repositorio a medias y luego no hay quien lo entienda.
    const malas = ['', 'lo que sea', 'https://gitlab.com/uno/dos', 'https://github.com/solo-usuario'];
    for (const url of malas) {
      const r = await api('/api/git-conectar', { method: 'POST', cuerpo: { url } });
      ok(`rechaza la direccion "${url.slice(0, 28)}"`, !!r.error);
    }

    const nombresMalos = ['', 'con espacios', 'con/barra'];
    for (const nombre of nombresMalos) {
      const r = await api('/api/git-crear', { method: 'POST', cuerpo: { nombre } });
      ok(`rechaza el nombre de repositorio "${nombre}"`, !!r.error);
    }

    const pagina = await (await fetch(base + '/')).text();
    ok('la interfaz tiene el asistente de la primera vez', /id="cajaPrimeraVez"/.test(pagina));
    ok('pide nombre y correo para git', /id="gitNombre"/.test(pagina) && /id="gitCorreo"/.test(pagina));
    ok('ofrece conectar con un repositorio ya creado', /id="btnGitConectar"/.test(pagina));
    ok('avisa de que Pages gratis necesita repositorio publico', /publico/.test(pagina) || /público/.test(pagina));
    ok('el push no se queda esperando una contrasena',
       /GIT_TERMINAL_PROMPT=0/.test(fs.readFileSync(path.join(RAIZ, 'panel', 'servidor.mjs'), 'utf8')));
  }

  console.log('\n--- Que se publica ---');
  {
    const est = await api('/api/estado');
    ok('cuenta por separado las preguntas', typeof est.git.cambiosBanco === 'number');
    ok('y el programa', typeof est.git.cambiosPrograma === 'number');
    ok('el total cuadra con la suma',
       est.git.cambios === est.git.cambiosBanco + est.git.cambiosPrograma);

    // El fallo que se vio en uso: el panel contaba archivos del programa pero
    // el botón sólo subía la carpeta de preguntas, así que no subía nada.
    const servidor = fs.readFileSync(path.join(RAIZ, 'panel', 'servidor.mjs'), 'utf8');
    const publicar = servidor.slice(servidor.indexOf("'POST /api/publicar'"),
                                    servidor.indexOf("'POST /api/publicar'") + 1200);
    ok('publicar sube todo lo que ha cambiado', /git add -A\\n/.test(publicar));
    ok('y ya no se limita a public/data', !/git add -A public\/data/.test(publicar));
    ok('el push tampoco se queda esperando una contrasena',
       /GIT_TERMINAL_PROMPT=0/.test(publicar));
    ok('enumera los archivos antes de subirlos', /--name-only/.test(publicar));

    const pagina = await (await fetch(base + '/')).text();
    ok('la interfaz desglosa preguntas y programa',
       /de preguntas/.test(pagina) && /del programa/.test(pagina));
  }

  console.log('\n--- Donde ha quedado publicada ---');
  {
    const d = await api('/api/pages');
    ok('responde sin romperse aunque no haya repositorio', typeof d.hay === 'boolean');

    const pagina = await (await fetch(base + '/')).text();
    ok('la interfaz reserva sitio para la direccion de la app', /id="estadoPages"/.test(pagina));
    const servidor = fs.readFileSync(path.join(RAIZ, 'panel', 'servidor.mjs'), 'utf8');
    ok('sabe deducir la direccion desde el repositorio', /github\.io/.test(servidor));
    ok('avisa si el repositorio es privado', /privado/.test(pagina));
  }

  console.log('\n--- Deteccion de actualizaciones ---');
  const act = await api('/api/actualizacion');
  ok('responde sin romperse', typeof act.hay === 'boolean' || act.motivo === 'no encontrada');
  if (act.origen) {
    ok('compara por contenido, no por fecha', Array.isArray(act.cambios));
    ok('no dice que hay cambios contra si mismo',
       act.origen === RAIZ ? act.hay === false : true);
  } else {
    console.log('  (no hay copia de Cowork en este equipo: se omite el resto)');
  }


  console.log('\n--- Ajustes por defecto ---');
  {
    // Sin ajustes guardados debe salir lo que viene de fábrica. Si no se borra
    // el archivo, se estaría comprobando lo que eligió la ejecución anterior.
    fs.rmSync(path.join(RAIZ, '.panel.json'), { force: true });
    const e = await api('/api/estado');
    ok('lee las capturas con el lector de macOS por defecto', e.ajustes.motor === 'macos');
    ok('sabe si el lector de macOS esta disponible', typeof e.macos?.ok === 'boolean');

    // La interfaz tiene que ofrecer el motor nuevo y presentarlo el primero.
    const pagina = await (await fetch(base + '/')).text();
    ok('el desplegable ofrece el lector de macOS', /<option value="macos">/.test(pagina));
    ok('y tambien la version con IA de refuerzo', /<option value="macos-ia">/.test(pagina));
    ok('el lector de macOS va el primero',
       pagina.indexOf('value="macos"') < pagina.indexOf('value="ocr"'));
    ok('usa gemma para las explicaciones por defecto', /^gemma/i.test(e.ajustes.modelo || ''));
    ok('usa gemma para ver las capturas por defecto', /^gemma/i.test(e.ajustes.modeloVision || ''));

    // Y lo que elijas se recuerda.
    await api('/api/ajustes', { method: 'POST', cuerpo: { motor: 'ambos', modelo: 'otro:7b' } });
    const e2 = await api('/api/estado');
    ok('recuerda el motor elegido', e2.ajustes.motor === 'ambos');
    ok('recuerda el modelo elegido', e2.ajustes.modelo === 'otro:7b');
    await api('/api/ajustes', { method: 'POST', cuerpo: { motor: 'macos', modelo: 'gemma4:latest' } });
  }

  console.log('\n--- Una prueba corta NO desactiva las explicaciones ---');
  {
    // El panel manda "limite" y "sinIa" por separado: limitar el número de
    // imágenes no debe quitar las explicaciones, porque entonces la prueba no
    // ejercitaría el camino del PDF y no probaría nada.
    const html = await (await fetch(base + '/')).text();
    const trozo = html.slice(html.indexOf("const cuerpo = {"), html.indexOf("const cuerpo = {") + 700);
    ok('sinIa depende solo de su casilla', /sinIa:\s*\$\('#opSinIa'\)\.checked/.test(trozo));
    ok('la prueba solo limita el numero de imagenes', /limite:\s*prueba \? 2 : undefined/.test(trozo));
    ok('el texto de la casilla ya no promete quitar explicaciones',
       !/2 imágenes por tema y sin explicaciones/.test(html));
  }

  console.log('\n--- Seguridad ---');
  const fuera = await fetch(base + '/../package.json');
  ok('no sirve archivos de fuera del panel', fuera.status === 404);

} catch (e) {
  console.log('  FALLO excepción: ' + e.message);
  fallos.push('excepción: ' + e.message);
}

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
cerrar(fallos.length ? 1 : 0);
