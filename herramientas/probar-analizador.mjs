// Pruebas del analizador del capturador.
// Uso:  node herramientas/probar-analizador.mjs
// Si tocas las expresiones regulares de capturador.html, ejecuta esto antes de fiarte.

import fs from 'node:fs';

// El analizador vive en importador/texto.mjs. capturador.html lleva una copia
// literal para funcionar sin servidor: aquí comprobamos las dos.
const { analizar } = await import('./importador/texto.mjs');

const html = fs.readFileSync(new URL('./capturador.html', import.meta.url), 'utf8');
const modulo = fs.readFileSync(new URL('./importador/texto.mjs', import.meta.url), 'utf8');
const recorta = (t, a, b) => {
  const i = t.indexOf(a), j = t.indexOf(b);
  if (i < 0 || j < 0) throw new Error('No se encontró el bloque del analizador');
  return t.slice(i, j).trim();
};
const copiaHtml = recorta(html, '// Quita marcas', '// Clave para detectar duplicados');
const copiaModulo = recorta(modulo, '// Quita marcas', '/** Clave para detectar duplicados');

let ok=0, ko=0;
function prueba(nombre, texto, esperado){
  const { preguntas } = analizar(texto);
  const real = preguntas.map(p=>({q:p.pregunta, o:p.opciones, c:p.correcta}));
  const igual = JSON.stringify(real)===JSON.stringify(esperado);
  if(igual){ ok++; console.log('  OK  ', nombre); }
  else { ko++; console.log('  FALLO', nombre); console.log('   esperado:', JSON.stringify(esperado)); console.log('   real    :', JSON.stringify(real)); }
}

console.log('--- Analizador ---');

prueba('asterisco al final + numeracion',
`1. ¿Cuál es la función del amortiguador?
a) Soportar el peso
b) Frenar oscilaciones *
c) Mantener altura
d) Corregir caída

2. ¿Qué mide el manómetro?
a) Temperatura
b) Presión *
c) Caudal
d) Par`,
[{q:'¿Cuál es la función del amortiguador?',o:['Soportar el peso','Frenar oscilaciones','Mantener altura','Corregir caída'],c:1},
 {q:'¿Qué mide el manómetro?',o:['Temperatura','Presión','Caudal','Par'],c:1}]);

prueba('respuesta en linea aparte',
`¿Qué mide el manómetro?
a) Temperatura
b) Presión
c) Caudal
d) Par
Respuesta correcta: b`,
[{q:'¿Qué mide el manómetro?',o:['Temperatura','Presión','Caudal','Par'],c:1}]);

prueba('vinetas con [x]',
`¿Qué mide el manómetro?
- Temperatura
- Presión [x]
- Caudal
- Par`,
[{q:'¿Qué mide el manómetro?',o:['Temperatura','Presión','Caudal','Par'],c:1}]);

prueba('opciones numeradas con visto y etiqueta Pregunta',
`Pregunta 4: ¿Qué mide el manómetro?
1) Temperatura
2) Presión ✓
3) Caudal
4) Par`,
[{q:'¿Qué mide el manómetro?',o:['Temperatura','Presión','Caudal','Par'],c:1}]);

prueba('sin linea en blanco entre preguntas',
`¿Primera pregunta?
a) uno
b) dos *
c) tres
d) cuatro
¿Segunda pregunta?
a) alfa
b) beta
c) gamma *
d) delta`,
[{q:'¿Primera pregunta?',o:['uno','dos','tres','cuatro'],c:1},
 {q:'¿Segunda pregunta?',o:['alfa','beta','gamma','delta'],c:2}]);

prueba('marca al principio y negrita',
`¿Cuál es la correcta?
a) uno
* b) dos
c) tres
d) cuatro

¿Y aquí?
a) uno
b) **dos**
c) tres
d) cuatro`,
[{q:'¿Cuál es la correcta?',o:['uno','dos','tres','cuatro'],c:1},
 {q:'¿Y aquí?',o:['uno','dos','tres','cuatro'],c:1}]);

prueba('enunciado en dos lineas',
`Según el principio de Pascal, la presión ejercida
sobre un fluido confinado e incompresible:
a) Se transmite por igual *
b) Disminuye con la distancia
c) Sólo en la dirección de la fuerza
d) Depende del volumen`,
[{q:'Según el principio de Pascal, la presión ejercida sobre un fluido confinado e incompresible:',o:['Se transmite por igual','Disminuye con la distancia','Sólo en la dirección de la fuerza','Depende del volumen'],c:0}]);

prueba('ruido de paginacion y separadores',
`Página 12
------------
1. ¿Pregunta con ruido?
a) uno
b) dos *
c) tres
d) cuatro
3 / 20`,
[{q:'¿Pregunta con ruido?',o:['uno','dos','tres','cuatro'],c:1}]);

prueba('sin marca de correcta -> correcta null',
`¿Sin marcar?
a) uno
b) dos
c) tres
d) cuatro`,
[{q:'¿Sin marcar?',o:['uno','dos','tres','cuatro'],c:null}]);

prueba('separadores con punto y guion',
`1- ¿Con guion?
a. uno
b. dos *
c. tres
d. cuatro`,
[{q:'¿Con guion?',o:['uno','dos','tres','cuatro'],c:1}]);


prueba('formato academia: PREGUNTA + Respuestas + opciones sin letra',
`PREGUNTA: (Identificador nº 2778104)
Para engranar ejes que se cruzan el tipo de dentado debe ser:
Respuestas
Recto
Helicoidal*
No puede realizarse este tipo de engranaje
Todas las demás respuestas son correctas.`,
[{q:'Para engranar ejes que se cruzan el tipo de dentado debe ser:',o:['Recto','Helicoidal','No puede realizarse este tipo de engranaje','Todas las demás respuestas son correctas.'],c:1}]);

prueba('formato academia: dos preguntas seguidas sin linea en blanco',
`PREGUNTA: (Identificador nº 111)
¿Primera?
Respuestas
uno
dos*
tres
cuatro
PREGUNTA: (Identificador nº 222)
¿Segunda?
Respuestas
alfa
beta
gamma*
delta`,
[{q:'¿Primera?',o:['uno','dos','tres','cuatro'],c:1},
 {q:'¿Segunda?',o:['alfa','beta','gamma','delta'],c:2}]);

prueba('formato academia sin la linea Respuestas',
`PREGUNTA: (Identificador nº 333)
¿Qué mide el manómetro?
Temperatura
Presión*
Caudal
Par`,
[{q:'¿Qué mide el manómetro?',o:['Temperatura','Presión','Caudal','Par'],c:1}]);

prueba('formato academia con enunciado en dos lineas',
`PREGUNTA: (Identificador nº 444)
Según el principio de Pascal, la presión ejercida
sobre un fluido confinado e incompresible:
Respuestas
Se transmite por igual*
Disminuye con la distancia
Sólo en la direccion de la fuerza
Depende del volumen`,
[{q:'Según el principio de Pascal, la presión ejercida sobre un fluido confinado e incompresible:',o:['Se transmite por igual','Disminuye con la distancia','Sólo en la direccion de la fuerza','Depende del volumen'],c:0}]);

prueba('la palabra Respuestas ya no genera un aviso falso',
`PREGUNTA: (Identificador nº 555)
¿Sin marcar la correcta?
Respuestas
uno
dos
tres
cuatro`,
[{q:'¿Sin marcar la correcta?',o:['uno','dos','tres','cuatro'],c:null}]);

// El identificador debe quedar guardado
{
  const { preguntas } = analizar(`PREGUNTA: (Identificador nº 2778104)
¿Con identificador?
Respuestas
uno
dos*`);
  const bien = preguntas[0] && preguntas[0].idExterno === '2778104';
  if(bien){ ok++; console.log('  OK   guarda el identificador de la academia'); }
  else { ko++; console.log('  FALLO guarda el identificador de la academia ->', JSON.stringify(preguntas[0])); }
}

// Sigue sin romperse "Respuesta correcta: b"


// --- Las dos copias del analizador deben ser idénticas --------------------
if (copiaHtml === copiaModulo) {
  ok++; console.log('  OK   capturador.html y texto.mjs tienen el mismo analizador');
} else {
  ko++;
  console.log('  FALLO capturador.html y texto.mjs se han desincronizado');
  console.log('        Copia el bloque de importador/texto.mjs dentro de capturador.html');
}

// El analizador del HTML se comporta igual que el módulo
{
  const delHtml = new Function(copiaHtml + '\n return analizar;')();
  const texto = 'PREGUNTA: (Identificador nº 42)\n¿Igual?\nRespuestas\nuno\ndos*\ntres\ncuatro';
  const a = JSON.stringify(delHtml(texto).preguntas);
  const b = JSON.stringify(analizar(texto).preguntas);
  if (a === b) { ok++; console.log('  OK   ambas copias dan el mismo resultado'); }
  else { ko++; console.log('  FALLO las copias dan resultados distintos'); }
}

console.log(`\nResultado: ${ok} OK, ${ko} fallos`);
process.exit(ko?1:0);
