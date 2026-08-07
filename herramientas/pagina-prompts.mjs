import fs from 'node:fs';
const lineas = fs.readFileSync('/tmp/prompts/prompts-ilustraciones.jsonl','utf8').trim().split('\n').map(JSON.parse);
const ESTILO = lineas[0].sistema;
const datos = lineas.map(l => ({ id: l.id, tema: l.tema, p: l.prompt }));
const html = `<!doctype html><html lang=es><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Prompts de ilustración</title>
<style>
:root{color-scheme:dark}
body{background:#0b1220;color:#e8ddc8;font:15px/1.6 -apple-system,system-ui,sans-serif;margin:0;padding:20px;max-width:860px;margin:auto}
h1{font-size:20px;margin:0 0 2px}
p.sub{color:#93a3bd;margin:0 0 20px;font-size:13px}
.caja{background:#111b2e;border:1px solid #24334d;border-radius:10px;padding:14px;margin-bottom:16px}
label{display:block;font-size:13px;color:#93a3bd;margin-bottom:6px}
select,button{font:inherit}
select{width:100%;padding:9px 10px;background:#0b1220;color:#e8ddc8;border:1px solid #2d4064;border-radius:8px}
button{padding:9px 14px;background:#2b6cb0;color:#fff;border:0;border-radius:8px;cursor:pointer;margin-top:10px}
button:hover{background:#3b82d6}
button.sec{background:#24334d}
button.sec:hover{background:#31456a}
textarea{width:100%;box-sizing:border-box;height:260px;margin-top:10px;background:#0b1220;color:#cfe3ff;border:1px solid #2d4064;border-radius:8px;padding:10px;font:12.5px/1.5 ui-monospace,Menlo,monospace;resize:vertical}
.fila{display:flex;gap:8px;flex-wrap:wrap}
.aviso{color:#7fd18f;font-size:13px;margin-left:8px;align-self:center}
ol{color:#93a3bd;font-size:13.5px;padding-left:20px}
code{background:#0b1220;padding:1px 5px;border-radius:4px;color:#cfe3ff}
</style>
<h1>Prompts de ilustración</h1>
<p class=sub>${datos.length} preguntas, un prompt por cada una. Elige, copia, pega.</p>

<div class=caja>
  <label>1 · Instrucción de estilo <em>(pégala una sola vez, al empezar la conversación)</em></label>
  <div class=fila><button onclick="copiar(estilo.value,this)">Copiar la instrucción de estilo</button>
  <button class=sec onclick="estilo.style.display=estilo.style.display?'':'none'">Ver / ocultar</button></div>
  <textarea id=estilo style="display:none" readonly>${ESTILO.replace(/</g,'&lt;')}</textarea>
</div>

<div class=caja>
  <label>2 · Pregunta</label>
  <select id=sel onchange="pintar()"></select>
  <div class=fila>
    <button onclick="copiar(txt.value,this)">Copiar este prompt</button>
    <button class=sec onclick="mover(-1)">← Anterior</button>
    <button class=sec onclick="mover(1)">Siguiente →</button>
  </div>
  <textarea id=txt readonly></textarea>
  <p class=sub id=nombre></p>
</div>

<div class=caja>
  <label>Cómo se usa</label>
  <ol>
    <li>Abre la IA que vayas a usar y pega la <b>instrucción de estilo</b>.</li>
    <li>Pega el prompt de una pregunta. Te devolverá un SVG.</li>
    <li>Guárdalo con el nombre que se indica: <code>cfsd-0007.svg</code>.</li>
    <li>Cuando tengas un montón, mételos todos de golpe en el panel: Banco → «Meter esas láminas» y le das la carpeta.</li>
  </ol>
</div>

<script>
const D = ${JSON.stringify(datos)};
for (const [i,d] of D.entries()) {
  const o = document.createElement('option');
  o.value = i; o.textContent = d.id + ' · ' + d.p.split('\\n')[0].replace('Pregunta de test: ','').slice(0,90);
  sel.appendChild(o);
}
function pintar(){ const d = D[sel.value]; txt.value = d.p; nombre.textContent = 'Guarda el SVG como  ' + d.id + '.svg   ·   ' + (d.tema||''); }
function mover(n){ sel.selectedIndex = Math.max(0, Math.min(D.length-1, sel.selectedIndex+n)); pintar(); }
function copiar(t,b){ navigator.clipboard.writeText(t); const a=b.textContent; b.textContent='Copiado ✓'; setTimeout(()=>b.textContent=a,1200); }
pintar();
</script>`;
fs.writeFileSync('/tmp/prompts/prompts-ilustraciones.html', html);
console.log('ok', (html.length/1024).toFixed(0)+' KB');
