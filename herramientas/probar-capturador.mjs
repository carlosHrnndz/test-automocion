// Pruebas de interfaz del capturador (requiere jsdom: npm install).
// Uso:  node herramientas/probar-capturador.mjs
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
const cambio = el => el.dispatchEvent(new w.Event('change',{bubbles:true}));

console.log('--- Carga ---');
ok('sin errores de script', !!$('#btnAnalizar'));
ok('modo rapido activado por defecto', $('#modoRapido').checked);
ok('modulos cargados', $('#selModulo').options.length === 10);
ok('submodulos del primer modulo', $('#selSub').options.length === 9);

console.log('--- Modo rapido con el formato de la academia ---');
$('#entrada').value = `PREGUNTA: (Identificador nº 2778104)
Para engranar ejes que se cruzan el tipo de dentado debe ser:
Respuestas
Recto
Helicoidal*
No puede realizarse este tipo de engranaje
Todas las demás respuestas son correctas.`;
clic($('#btnAnalizar'));

let banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('guardada directamente sin revisar', banco.length === 1);
ok('enunciado limpio', banco[0]?.pregunta === 'Para engranar ejes que se cruzan el tipo de dentado debe ser:');
ok('4 opciones sin la palabra Respuestas', banco[0]?.opciones.length === 4 && !banco[0].opciones.includes('Respuestas'));
ok('correcta = Helicoidal (indice 1)', banco[0]?.correcta === 1);
ok('sin el asterisco en el texto', banco[0]?.opciones[1] === 'Helicoidal');
ok('identificador guardado', banco[0]?.idExterno === '2778104');
ok('id interno asignado', banco[0]?.id === 'cfsd-0001');
ok('modulo y tema aplicados', banco[0]?.moduloId === 'cfsd' && banco[0]?.submodulo === 'SISTEMAS MECÁNICOS');
ok('cuadro vaciado para la siguiente', $('#entrada').value === '');
ok('aviso flotante visible', $('#toast').classList.contains('ver'));
ok('reciente listado con deshacer', !!$('#recientes button[data-quitar]'));

console.log('--- Segunda pregunta seguida ---');
$('#entrada').value = `PREGUNTA: (Identificador nº 2778105)
¿Qué mide un manómetro?
Respuestas
Temperatura
Presión*
Caudal
Par`;
clic($('#btnAnalizar'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('dos preguntas en el banco', banco.length === 2);
ok('ids correlativos', banco[1]?.id === 'cfsd-0002');

console.log('--- Duplicado por identificador ---');
$('#entrada').value = `PREGUNTA: (Identificador nº 2778104)
Da igual que cambie el texto, el identificador manda:
Respuestas
uno
dos*
tres
cuatro`;
clic($('#btnAnalizar'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('el duplicado no entra', banco.length === 2);
ok('avisa de duplicado', $('#toast').classList.contains('malo'));

console.log('--- Sin marcar la correcta: se para y pide revision ---');
$('#entrada').value = `PREGUNTA: (Identificador nº 999)
¿Sin correcta marcada?
Respuestas
uno
dos
tres
cuatro`;
clic($('#btnAnalizar'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('no la guarda automaticamente', banco.length === 2);
ok('muestra la caja de revision', !$('#cajaRevision').hidden);
ok('marca la tarjeta en ambar', !!$('#listaRevision .p.aviso'));
ok('avisa en el aviso flotante', $('#toast').classList.contains('malo'));
ok('muestra las letras A) B) C) D)', $$('#listaRevision .letra').map(x=>x.textContent).join('') === 'A)B)C)D)');

// Marcar la correcta a mano y guardar
const radios = $$('#listaRevision input[type=radio]');
radios[2].checked = true; cambio(radios[2]);
clic($('#btnGuardar'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('guardada tras corregir a mano', banco.length === 3 && banco[2].correcta === 2);

console.log('--- Deshacer ---');
clic($('#recientes button[data-quitar]'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('deshacer elimina la ultima', banco.length === 2);

console.log('--- Gestor del banco ---');
clic($$('nav button').find(b=>b.dataset.vista==='banco'));
ok('tabla con una fila por pregunta', $$('#listaBanco tr.fila').length === 2);
ok('muestra la letra correcta', $('#listaBanco .celda-enun .fin').textContent.includes('correcta B'));
ok('borrar seleccionadas empieza desactivado', $('#btnBorrarSel').disabled);

// Seleccionar una
const casilla = $('#listaBanco input[data-sel]');
clic(casilla);
ok('se activa el borrado en bloque', !$('#btnBorrarSel').disabled);
ok('cuenta la seleccion', $('#infoSeleccion').textContent.includes('1'));

// Seleccionar todas
$('#selTodas').checked = true; cambio($('#selTodas'));
ok('seleccionar todas marca las dos', $('#infoSeleccion').textContent.includes('2'));

// Desplegar el editor
clic($('#listaBanco tr.fila'));
ok('el editor se despliega', !!$('#editorBanco .p'));
ok('el editor trae explicacion y ejemplo', $$('#editorBanco textarea[data-campo]').length === 2);
clic($('#listaBanco tr.fila'));
ok('se pliega al volver a pulsar', !$('#editorBanco .p'));

// Borrado en bloque
w.confirm = () => true;
clic($('#btnBorrarSel'));
banco = JSON.parse(w.localStorage.getItem('cap_banco')||'[]');
ok('borrado en bloque vacia el banco', banco.length === 0);
ok('la tabla queda vacia', $('#listaBanco').textContent.includes('Ninguna pregunta'));

console.log(fallos.length ? `\n>>> ${fallos.length} FALLOS: ${fallos.join(' | ')}` : '\n>>> Todo correcto');
process.exit(fallos.length?1:0);
