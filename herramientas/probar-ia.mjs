// Prueba del flujo con Ollama, simulando un modelo pequeño (respuestas sucias incluidas).
// Uso:  node herramientas/probar-ia.mjs   (requiere jsdom: npm install)
import fs from 'node:fs';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch {
  console.log('Falta jsdom. Ejecuta "npm install" en la raiz del proyecto.');
  process.exit(0);
}

const RUTA = new URL('./capturador.html', import.meta.url);
const dom = new JSDOM(fs.readFileSync(RUTA,'utf8'), { url:'http://localhost/', runScripts:'dangerously' });
const w = dom.window, d = w.document;
await new Promise(r => w.addEventListener('load', r));

const fallos=[];
const $=s=>d.querySelector(s), $$=s=>[...d.querySelectorAll(s)];
function ok(n,c){ console.log((c?'  OK   ':'  FALLO')+' '+n); if(!c) fallos.push(n); }
const clic = el => el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const esperar = ms => new Promise(r=>setTimeout(r,ms));
w.confirm = () => true;
w.alert = () => {};

// --- Ollama simulado -------------------------------------------------------
let modoOllama = 'ok';
let llamadas = [];
w.fetch = async (url, opciones={}) => {
  const u = String(url);
  if(modoOllama === 'caido') throw new TypeError('Failed to fetch');
  if(u.endsWith('/api/tags')){
    return { ok:true, status:200, json:async()=>({ models:[
      { name:'llama3.2:3b', size:2.0e9 }, { name:'qwen3:4b', size:2.6e9 } ]}) };
  }
  if(u.endsWith('/api/chat')){
    llamadas.push(JSON.parse(opciones.body));
    if(modoOllama === 'formato-malo')
      return { ok:true, status:200, json:async()=>({ message:{ content:'Pues verás, la respuesta es la B porque sí.' } }) };
    // Respuesta típica de un modelo pequeño: con <think>, markdown y espacios de más
    return { ok:true, status:200, json:async()=>({ message:{ content:
      '<think>El usuario pregunta por engranajes...</think>\n' +
      '**EXPLICACION:** El dentado helicoidal permite   transmitir movimiento\nentre ejes que se cruzan.\n' +
      'EJEMPLO: En una caja de cambios lo notas en que engrana suave.\n' } }) };
  }
  throw new Error('URL inesperada: ' + u);
};

// --- Meter una pregunta ----------------------------------------------------
$('#entrada').value = `PREGUNTA: (Identificador nº 2778104)
Para engranar ejes que se cruzan el tipo de dentado debe ser:
Respuestas
Recto
Helicoidal*
No puede realizarse este tipo de engranaje
Todas las demás respuestas son correctas.`;
clic($('#btnAnalizar'));

console.log('--- Conexion con Ollama ---');
clic($$('nav button').find(b=>b.dataset.vista==='ia'));
ok('generar empieza desactivado', $('#btnGenerar').disabled);
ok('url por defecto', $('#urlOllama').value === 'http://localhost:11434');
clic($('#btnProbar'));
await esperar(60);
ok('detecta los modelos instalados', $('#modelo').options.length === 2);
ok('ordena los pequenos primero', $('#modelo').value === 'qwen3:4b');
ok('habilita generar', !$('#btnGenerar').disabled);
ok('lo dice en el registro', $('#logIA').textContent.includes('Conectado'));

console.log('--- Generacion ---');
ok('cuenta las pendientes', $('#infoIA').textContent.includes('1 pregunta'));
clic($('#btnGenerar'));
await esperar(200);

let banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('una llamada por pregunta', llamadas.length === 1);
ok('no envia lotes', llamadas[0].messages.length === 2);
ok('desactiva el modo pensar', llamadas[0].think === false);
ok('manda la correcta al modelo', llamadas[0].messages[1].content.includes('Respuesta correcta: B) Helicoidal'));
ok('explicacion extraida', banco[0]?.explicacion.startsWith('El dentado helicoidal permite'));
ok('quita el bloque de razonamiento', !banco[0]?.explicacion.includes('think'));
ok('quita el markdown', !banco[0]?.explicacion.includes('**'));
ok('normaliza espacios y saltos', banco[0]?.explicacion === 'El dentado helicoidal permite transmitir movimiento entre ejes que se cruzan.');
ok('ejemplo extraido', banco[0]?.ejemplo === 'En una caja de cambios lo notas en que engrana suave.');
ok('queda marcada SIN revisar', banco[0]?.revisado === false);
ok('lo avisa en el registro', $('#logIA').textContent.includes('SIN REVISAR'));

console.log('--- Circuito de revision ---');
clic($$('nav button').find(b=>b.dataset.vista==='banco'));
ok('la tabla lo marca en rojo', $('#listaBanco').textContent.includes('sin revisar'));
ok('el resumen cuenta las pendientes', $('#resumenBanco').textContent.includes('Sin revisar'));
clic($('#listaBanco tr.fila'));
ok('el editor avisa', $('#editorBanco').textContent.includes('sin revisar'));
clic($('#editorBanco [data-accion=revisar]'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('marcar como revisada funciona', banco[0]?.revisado === true);
ok('la tabla pasa a revisada', $('#listaBanco').textContent.includes('revisada'));

console.log('--- Filtros nuevos ---');
$('#filtroEstado').value = 'sin-revisar'; $('#filtroEstado').dispatchEvent(new w.Event('change',{bubbles:true}));
ok('filtro sin revisar queda vacio', $('#listaBanco').textContent.includes('Ninguna pregunta'));
$('#filtroEstado').value = 'revisadas'; $('#filtroEstado').dispatchEvent(new w.Event('change',{bubbles:true}));
ok('filtro revisadas la encuentra', $$('#listaBanco tr.fila').length === 1);

console.log('--- El modelo se sale del formato ---');
$('#filtroEstado').value = ''; $('#filtroEstado').dispatchEvent(new w.Event('change',{bubbles:true}));
modoOllama = 'formato-malo';
clic($$('nav button').find(b=>b.dataset.vista==='ia'));
$('#iaQue').value = 'todas'; $('#iaQue').dispatchEvent(new w.Event('change',{bubbles:true}));
const antes = JSON.parse(w.localStorage.getItem('cap_banco'))[0].explicacion;
clic($('#btnGenerar'));
await esperar(200);
banco = JSON.parse(w.localStorage.getItem('cap_banco'));
ok('no pisa lo bueno con una respuesta invalida', banco[0].explicacion === antes);
ok('registra el error de formato', $('#logIA').textContent.includes('formato'));

console.log('--- Ollama cerrado ---');
modoOllama = 'caido';
clic($('#btnProbar'));
await esperar(60);
ok('desactiva generar', $('#btnGenerar').disabled);
ok('explica como arreglarlo', $('#logIA').textContent.includes('OLLAMA_ORIGINS'));
ok('menciona el servidor local como plan B', $('#logIA').textContent.includes('http.server'));

console.log('--- Export ---');
modoOllama = 'ok';
clic($$('nav button').find(b=>b.dataset.vista==='exportar'));
ok('exporta sin avisar si todo esta revisado', !$('#resumenExport').textContent.includes('sin revisar'));

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length?1:0);
