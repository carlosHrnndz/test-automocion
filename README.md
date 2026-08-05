# Test de Mecánica · Técnico Superior en Automoción

## Empieza aquí: doble clic en `Panel.command`

Se abre una ventana de Terminal (déjala abierta) y el panel en el navegador. Desde ahí
haces **todo** sin escribir un solo comando:

- **Importar** carpetas de capturas, navegando hasta ellas con el ratón.
- **Revisar** y corregir las preguntas, con guardado inmediato.
- **Pegar** preguntas sueltas en texto, o el JSON de un modelo de visión.
- **Generar** explicaciones con el modelo local.
- **Ver** la app antes de publicarla.
- **Publicar** en GitHub con un botón.

La primera vez tarda un minuto instalando lo necesario. Si te dice que falta Node.js,
descárgalo de [nodejs.org](https://nodejs.org) (versión LTS) y vuelve a hacer doble clic.

El panel también avisa de lo que falte: si Ollama está cerrado, si no está el lector de
imágenes, o si el repositorio no está conectado a GitHub.

**Para actualizarlo** cuando haya una versión nueva: pestaña **Inicio**, botón
**Actualizar ahora**. Busca la copia más reciente, la trae sin tocar tus preguntas y te
dice que cierres y vuelvas a abrir. Sin comandos.

---

## Las piezas por debajo

| | Qué es | Sin el panel |
|---|---|---|
| **Panel** | La interfaz que gobierna todo lo demás | `npm run panel` |
| **Importador** | Lee capturas, saca pregunta, opciones y la marcada en verde | `npm run importar -- ~/carpeta` |
| **Capturador** | Versión suelta para pegar texto sin servidor | `herramientas/capturador.html` |
| **App de test** | Lo que estudias: tests, repaso de fallos, modo estudio | Publicada en GitHub Pages |

El flujo habitual, todo desde el panel:

```
carpetas de capturas  →  Importar  →  Banco (revisar)  →  Publicar
```

Lo que sigue documenta cada pieza por dentro, por si algún día quieres tocarlas o el
panel se queda corto. **Si sólo vas a usarlo, con lo de arriba te sobra.**

---

## Puesta en marcha (una sola vez)

### 1. Subir el proyecto a GitHub

Desde el panel, pestaña **Publicar**. La primera vez sale un asistente de dos pasos:

1. **Preparar la carpeta.** Pide tu nombre y tu correo (git los apunta en cada
   cambio) y guarda la primera versión.
2. **Conectar con GitHub.** Si tienes instalada la herramienta oficial de GitHub
   y la sesión abierta, el panel crea el repositorio y lo sube él. Si no, te dice
   dónde crearlo y sólo tienes que pegar la dirección.

Para que el panel pueda hacerlo todo solo, en el Terminal, una vez en la vida:

```bash
brew install gh
gh auth login
```

Sin eso funciona igual, pero GitHub pedirá permiso al subir y hay que resolverlo
a mano.

### Qué sube el botón Publicar

Todo lo que haya cambiado: las preguntas del banco **y** el programa. El panel te
lo desglosa antes («3 archivos: 1 de preguntas y 2 del programa») y el registro
enumera los archivos que sube.

Es importante que suba las dos cosas: si el programa se actualiza y no se publica,
los arreglos no llegan nunca a la app del móvil.

### 2. Activar GitHub Pages

En la pestaña **Publicar**, debajo del estado, el panel te dice si GitHub está
sirviendo la app o no, y te da el botón que falte:

- **404 al abrir la dirección** → «Activar Pages y construir».
- **Repositorio privado** → «Hacerlo público», porque Pages gratuito sólo publica
  los públicos. Ojo: al hacerlo, cualquiera podrá ver tus preguntas.
- **Todo listo** → sale la dirección de tu app, para abrirla en el móvil.

A mano también se puede: **Settings → Pages → Source → GitHub Actions**.

**El repositorio tiene que ser público** para que Pages funcione con una cuenta
gratuita. En privado tendrás el respaldo de las preguntas, pero no la dirección web.

Con eso, cada publicación reconstruye y republica la app sola. Estará en
`https://TU-USUARIO.github.io/test-automocion/`. La ruta base se calcula automáticamente
a partir del nombre del repositorio, así que puedes llamarlo como quieras.

### 3. Instalarla en el móvil

Abre esa dirección en Chrome o Safari y elige **Añadir a pantalla de inicio**.
Queda como una app normal y **funciona sin conexión**, preguntas incluidas.

---

## Trabajar en local (opcional)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

Sólo hace falta si quieres ver los cambios antes de publicarlos. Para añadir preguntas
no necesitas Node para nada.

---

## El importador de capturas

Lee una carpeta entera de capturas de pantalla y monta el banco de preguntas solo.

### Qué hay que instalar

```bash
npm install                              # dependencias del proyecto
```

Y ya está: el lector de texto que se usa por defecto es el que trae macOS de fábrica,
el mismo de Vista Previa. Si el panel te dice que faltan las herramientas de Apple,
en el Terminal, una sola vez:

```bash
xcode-select --install
```

Sólo si quieres usar además el motor antiguo (Tesseract):

```bash
brew install tesseract tesseract-lang    # el segundo trae el español
```

### Cómo organizar las carpetas

Dos niveles: módulo y dentro tema. El PDF del temario va junto a las imágenes.

```
~/Automocion/
  CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN/
    RUEDAS/
      001.png
      002.png
      temario.pdf
    EL SISTEMA DE DIRECCIÓN/
      ...
  MOTORES/
    ...
```

El nombre de la carpeta de módulo se empareja solo con el temario: vale el nombre
completo, una parte reconocible, o directamente el código corto (`cfsd`, `mot`, `stf`…).
Si una carpeta no encaja con ningún módulo, te lo dice y sigue con las demás en vez
de fallar. **El nombre de la carpeta de tema se usa tal cual como submódulo**, así que
escríbelo como quieras que aparezca en la app.

### Ejecutarlo

**Desde la carpeta del proyecto**, que es donde está `package.json`. `npm run` no
funciona desde otro sitio:

```bash
cd ~/donde/tengas/test-automocion
npm run importar -- ~/Automocion
```

Ojo con las comillas si la ruta lleva espacios o acentos:

```bash
npm run importar -- "/Users/carlos/Documents/.../CIRCUITOS DE FLUIDOS SUSPENSION Y DIRECCION"
```

**No hace falta que aciertes con el nivel de carpeta.** Le puedes pasar la carpeta que
contiene los módulos, la de un módulo concreto, o la de un tema suelto: lo detecta solo
y te dice qué ha entendido. Si le das un tema suelto y no puede deducir el módulo del
nombre de la carpeta padre, te lo pide con `--modulo cfsd`.

Tampoco hace falta que el nombre esté perfecto: `CIRCUITOS DE FLUIDOS SUPENSION Y
DIRECCION`, sin tilde y con la errata, se empareja igual con el módulo correcto.

| Opción | Para qué |
|---|---|
| `--sin-ia` | Sólo extrae preguntas, sin generar explicaciones. Mucho más rápido |
| `--limite 3` | Procesa como mucho 3 imágenes por tema. Ideal para la primera prueba. **No** desactiva las explicaciones: una prueba tiene que probar el camino completo |
| `--modulo cfsd` | Fuerza el módulo cuando no se puede deducir de la carpeta |
| `--modelo qwen3:8b` | Otro modelo de Ollama |
| `--forzar` | Rehace las que ya estaban, en su sitio y sin duplicar |
| `--limpiar` | Vacía los módulos afectados antes de importar. Para empezar de cero |

### Cuando dice "0 nuevas · N repetidas"

Significa que esas preguntas ya estaban en `public/data/preguntas/`. Se comparan por el
**identificador de la academia**, no por el nombre del archivo: la misma pregunta no entra
dos veces aunque renombres la captura o la muevas de carpeta.

- ¿Quieres **empezar de cero**? `--limpiar` vacía el módulo antes de importar.
- ¿Quieres **rehacer las explicaciones** sin perder el resto? `--forzar` las actualiza en
  su sitio, conservando el id, sin crear duplicados.

Ojo con un efecto de esto: si la misma pregunta aparece en dos temas —típico de las
carpetas de *TEST PARCIAL*, que repiten preguntas de otros temas— sólo entra una vez, en
el tema que se procese primero (van por orden alfabético). Si prefieres que cada tema
tenga su copia completa, dímelo y cambio la comparación para que sea por tema en lugar
de por módulo.

**Empieza siempre así**, para comprobar que lee bien tus capturas antes de lanzarte:

```bash
npm run importar -- ~/Automocion --limite 2 --sin-ia
```

### Cómo sabe cuál es la respuesta correcta

Por el color, no por el texto. Busca las franjas de píxeles verdes de la imagen y mira
qué opción cae dentro. Es aritmética pura: mientras la academia siga marcando la correcta
en verde, no se equivoca nunca. Si en alguna captura no encuentra verde, **no adivina**:
deja la pregunta marcada para que la corrijas a mano y te lo dice en el resumen.

### Qué hace para leer bien las capturas

El OCR es **Tesseract**, un reconocedor de caracteres clásico. No es una IA: no
alucina, pero confunde letras, y en capturas de pantalla la letra es pequeña. Dos
medidas contra eso:

- **Amplía la imagen al doble** antes de leerla, con suavizado. Medido sobre una
  captura real de baja resolución: sin ampliar acierta al 74 % y sólo encuentra una
  opción; ampliada sube al 96 % y encuentra las cuatro, con las tildes bien.
- **Descarta lo que no está alineado.** Todas las opciones arrancan a la misma
  distancia del margen izquierdo. Lo que aparezca desplazado —el cursor del ratón, un
  pie de página, el borde de la ventana— no es una opción, por mucho que se lea.

También detecta y avisa cuando:

- Una opción ocupa dos líneas (las une sola).
- La confianza del OCR baja del 75 %.
- Salen más de 4 opciones, que suele ser una partida en dos.
- Alguna opción es sospechosamente corta.
- Hay más de una zona verde.
- La imagen no tiene la cabecera `PREGUNTA:` o la línea `RESPUESTAS`.

**Aun así, Tesseract nunca acierta al 100 %.** Revisa en el Banco todo lo que salga
con avisos antes de estudiarlo.

### Formas de leer las capturas

En el panel, al importar, eliges cómo se leen las capturas. El importador recorre las
carpetas igual en todos los casos; lo único que cambia es quién mira la imagen.

| Motor | Velocidad | Qué hace bien | Qué hace mal |
|---|---|---|---|
| **Lector de macOS** (por defecto) | décimas de segundo | Es el mejor leyendo, incluido el texto blanco sobre el verde. No inventa nada | Sólo funciona en un Mac |
| **Lector de macOS + IA** | rápido casi siempre | Igual, pero si una captura se le atraganta llama al modelo de visión | Esas pocas tardan un minuto |
| **Lector de texto** (Tesseract) | segundos | No inventa nada | Confunde letras, a veces pierde una opción |
| **Modelo de visión** | un minuto o más | Entiende la estructura de la página | Puede escribir frases que no están, y marcar la correcta que él cree |
| **Los dos combinados** | lo más lento | El texto lo pone el modelo y **la respuesta correcta la decide el color verde** | Nada, salvo el tiempo |

**Usa el lector de macOS.** Es el mismo motor que hay detrás de Vista Previa cuando
seleccionas texto dentro de una imagen: si ahí se lee bien, aquí también. Va unas
cien veces más rápido que un modelo de visión y no se inventa nada, porque no es
un modelo generativo. En cualquiera de los motores, **la respuesta correcta la sigue
decidiendo el color verde**, que es aritmética sobre píxeles y no falla.

La primera vez que lo uses tarda unos segundos más: compila un programa diminuto en
Swift y lo deja guardado. Después ya no vuelve a hacerlo. Si te dice que faltan las
herramientas de Apple, en el Terminal, una sola vez:

```
xcode-select --install
```

Cuando el modelo y el verde discrepan, te lo dice:

```
! 001.png → cfsd-0007
    El modelo señaló la opción A pero la pintada de verde es la D. Manda el verde.
```

Desde el terminal es `--motor macos`, `--motor macos-ia`, `--motor ocr`,
`--motor vision` o `--motor ambos`, con `--modelo-vision gemma3:4b`. El modelo tiene
que **ver imágenes**: no todos los de Ollama lo hacen. `gemma3:4b` sí, y cabe en 8 GB.

### El Banco

Dos columnas: la lista a la izquierda y el editor fijo a la derecha. Al pulsar una
pregunta se abre al lado, sin que la página se mueva, y la lista se queda donde
estaba.

La casilla de cada fila **selecciona**; el resto de la fila **abre el editor**. Son
dos cosas distintas y no se pisan.

Dentro del editor:

- El texto de cada respuesta se edita escribiendo encima. Para marcar cuál es la
  correcta hay que pulsar su letra o su círculo — escribir en una respuesta no la
  marca.
- La **✕** de cada respuesta la quita. Sirve para las preguntas que salieron con
  una opción de más; el aviso amarillo las señala. Si quitas la que estaba marcada
  como correcta, te avisa para que la vuelvas a elegir.
- **+ Añadir respuesta** por si falta alguna.

Sobre lo seleccionado se pueden hacer tres cosas en bloque: ponerles tema, marcarlas
como revisadas (sólo las que ya tengan explicación) y borrarlas.

### Poner el tema a preguntas que ya están en el banco

Si se añaden preguntas sin elegir el tema, entran como **Sin clasificar** y desde
la app no se pueden filtrar por tema. Se arregla desde el panel sin tocar nada a
mano:

1. Pestaña **Banco**.
2. En el desplegable de la derecha, elige **Sin tema**. Salen sólo esas.
3. Marca **Seleccionar todas** (o las que quieras).
4. Escribe el tema en la casilla de abajo —sugiere los del temario del módulo y
   los que ya uses— y pulsa **Poner este tema a las seleccionadas**.

Sólo cambia el tema: ni el módulo, ni los identificadores, ni el texto. Si las
preguntas son de temas distintos, se hace en varias tandas usando el buscador
para separarlas.

### Cuando una captura no sale bien

Hay una herramienta que enseña, línea por línea, exactamente lo que el lector ve
en una captura y cómo lo interpreta el analizador. No toca el banco: sólo imprime.

```bash
cd ~/Projects/test-automocion
node herramientas/ver-lectura.mjs "/ruta/a/la/captura.png"
```

Saca las bandas verdes con sus coordenadas, cada línea de texto con su posición y
su confianza, y debajo el enunciado, las opciones y cuál ha marcado como correcta.
Con eso se ve enseguida si el problema es la lectura o el agrupado. Para comparar
con el motor antiguo, `--motor ocr` al final.

### Cómo decide dónde acaba cada opción

Por los huecos entre líneas, no por su altura. Cada lector devuelve las cajas de
texto con distinto grosor —las de Vision son más altas que las de Tesseract—, así
que medir el hueco contra la altura de la caja daba resultados opuestos según el
motor: con uno se partía cada opción en trozos y con otro se fusionaban las cuatro
en una.

Ahora se miran todos los huecos de la imagen y se busca un **salto claro** entre
ellos: si un hueco es 2,5 veces mayor que otro, ahí hay dos cosas distintas —el
espacio entre líneas de una misma opción y el espacio entre opciones—. Si todos
los huecos son parecidos, no hay nada que unir: cada línea es una opción. Ante la
duda no fusiona, porque una opción de más se ve a simple vista en el Banco y una
de menos desaparece sin dejar rastro.

### Si prefieres hacerlo a mano en Ollama

Si quieres pasar tú las capturas por Ollama en vez de usar el importador, los prompts
están en [`PROMPT-OLLAMA.md`](PROMPT-OLLAMA.md), y el resultado se pega en
el panel: pestaña **Pegar texto** → cuadro **…o pega el JSON de un modelo de visión**.

Acepta el JSON tal como suele salir: con <code>```json</code>, con texto alrededor,
con bloques de razonamiento, una pregunta o varias. Y avisa de lo dudoso: confianza
baja, partes marcadas como ilegibles, o preguntas sin respuesta correcta.

Ten en cuenta la diferencia de fondo: Tesseract confunde letras y se nota; un modelo
de visión puede escribir una frase entera que no estaba en la imagen y sonar perfecta.
El riesgo mayor es que marque como correcta la que él cree, en vez de la que está
pintada de verde. Compruébalo con la captura delante.

El identificador de la academia (`nº 2778097`) se guarda y sirve para no importar dos
veces la misma pregunta, aunque vuelvas a pasar la carpeta entera.

### Qué pinta el PDF en todo esto

Si hay un PDF junto a las imágenes, el importador extrae su texto, lo trocea y, para cada
pregunta, busca los dos fragmentos que más tienen que ver con ella. Esos fragmentos se le
pasan al modelo local como material de referencia.

Esto cambia bastante la calidad: en vez de pedirle a un modelo de 4B que recuerde mecánica
de automoción —que es justo donde se inventa cosas— le pones delante el trozo del temario
que habla del asunto y le pides que explique con eso. Además rellena solo
`material.pdf` y `material.pagina`, así que en la app aparece el botón *PDF · pág. 12*
bajo la explicación.

Si el PDF resulta ser un escaneo sin texto, te avisa y sigue sin él.

**Las explicaciones se generan al importar**, que es el único momento en que el
importador tiene las carpetas delante y puede leer los PDF. El botón *Generar las que
faltan* de la pestaña Banco es un apaño para las preguntas metidas a mano: funciona,
pero genera de memoria del modelo, sin temario.

En el registro se ve cuál ha sido el caso, pregunta a pregunta:

```
✓ 001.png → mot-0001 · 4 opciones · D correcta · con el temario (pág. 12, 13)
✓ 002.png → mot-0002 · 4 opciones · B correcta · sin pasajes del temario para esta
```

---

## El capturador

Abre `herramientas/capturador.html` con doble clic. Funciona en cualquier navegador,
sin servidor y sin conexión (salvo para la generación con IA).

Con el importador funcionando, el capturador queda para dos cosas: **revisar** lo que
ha entrado (pestaña Banco) y **meter preguntas sueltas** pegando texto.

**Para revisar lo que ha importado el script**, hay que hacer un viaje de ida y vuelta,
porque el importador escribe en `public/data/` y el capturador trabaja sobre su propio
banco dentro del navegador:

1. Capturador → **Exportar** → *Restaurar copia* → elige `public/data/preguntas/cfsd.json`.
2. Pestaña **Banco**, filtro *Sin revisar*. Corrige lo que haga falta y ve dándole a *Revisada*.
3. **Exportar** → *Descargar paquete data.zip* → descomprime y sustituye `public/data/`.

Los duplicados se descartan por identificador, así que puedes hacer esto tantas veces
como quieras sin miedo a duplicar nada. Los campos `origen` y `confianzaOcr` sobreviven
al viaje, de modo que siempre puedes volver a la captura de la que salió cada pregunta.

### Cómo se pegan las preguntas

Elige módulo y tema una vez — se quedan fijos — y a partir de ahí sólo pegas preguntas.

El formato de tu academia funciona tal cual. Lo único que tienes que añadir es el
asterisco en la respuesta correcta:

```
PREGUNTA: (Identificador nº 2778104)
Para engranar ejes que se cruzan el tipo de dentado debe ser:
Respuestas
Recto
Helicoidal*
No puede realizarse este tipo de engranaje
Todas las demás respuestas son correctas.
```

La línea `Respuestas` marca dónde acaba el enunciado y empiezan las opciones: a partir de
ahí cada línea es una opción, aunque no lleve letra ni guion. Las letras **a) b) c) d)**
las pone la app sola. Si esa línea no aparece, el analizador da por terminado el enunciado
en cuanto encuentra un `?`, `:` o `.` final, así que también funciona sin ella.

El **identificador** se guarda en el JSON y es lo que se usa para detectar duplicados:
aunque cambies el enunciado, esa pregunta no entrará dos veces.

### Modo rápido: una pregunta cada vez

Está activado por defecto y es el flujo pensado para ir metiendo preguntas del tirón:

1. Pegas la pregunta en el cuadro.
2. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (o el botón **Analizar y guardar**).
3. Se guarda, el cuadro se vacía y el cursor vuelve dentro. Lista la siguiente.

Sólo se detiene si algo no cuadra: si falta la respuesta correcta o el analizador tiene
dudas, en lugar de guardar te muestra la pregunta para que la corrijas a mano. Si la
pregunta ya estaba en el banco te lo dice y limpia el cuadro igualmente.

Bajo el cuadro se quedan **las últimas cinco guardadas** con un botón de deshacer, por si
te das cuenta al momento de que has metido algo mal.

Si prefieres pegar tandas grandes de golpe, desactiva el modo rápido: entonces siempre
verás la lista completa para revisar antes de guardar.

### Otros formatos que también entiende

Formas válidas de marcar la correcta:

| Forma | Ejemplo |
|---|---|
| Asterisco al final | `b) Frenar las oscilaciones *` |
| Corchete | `b) Frenar las oscilaciones [x]` |
| Visto | `b) Frenar las oscilaciones ✓` |
| Negrita markdown | `b) **Frenar las oscilaciones**` |
| Asterisco delante | `* b) Frenar las oscilaciones` |
| Línea aparte | `Respuesta correcta: b` |

También acepta opciones con `a.` `a-` `1)` o viñetas `-`, enunciados repartidos en
varias líneas, la etiqueta `Pregunta 4:` y descarta sola la paginación tipo `Página 12`.

**Consejo:** si pegas varias preguntas de golpe, deja una línea en blanco entre ellas.
Sin ella también funciona, pero es lo único que puede confundir al analizador cuando hay
preguntas de sólo dos opciones.

Cuando el modo rápido se detiene, todo es editable: enunciado, opciones, cuál es la
correcta, explicación, ejemplo y los enlaces al material. Las preguntas sin correcta
detectada salen con el borde en ámbar para que no se te pasen.

### Gestor del banco

La pestaña **Banco** es la lista completa de lo que llevas capturado, una fila por
pregunta con su id, el tema y si tiene explicación:

- **Pulsa una fila** para desplegarla y editarla; se guarda al salir de cada campo.
- **Borrar** en la propia fila para eliminarla suelta.
- **Casillas + Borrar seleccionadas** para quitar varias de una vez.
- Filtros por módulo, por estado (sin explicación, sin ejemplo) y buscador por enunciado.
  Al filtrar y pulsar *Seleccionar todas* actúas sólo sobre lo que estás viendo.

### Generar explicaciones y ejemplos (modelo local, sin internet)

Pestaña **Explicaciones IA**. Todo corre en tu Mac con [Ollama](https://ollama.com):
no sale nada a internet, no hay clave de API y no cuesta dinero.

#### Puesta en marcha, una sola vez

1. Instala Ollama desde [ollama.com/download](https://ollama.com/download) y ábrelo.
2. Descarga el modelo:

   ```bash
   ollama pull qwen3:4b
   ```

3. Dale permiso para hablar con la página:

   ```bash
   launchctl setenv OLLAMA_ORIGINS "*"
   ```

   Después **cierra Ollama del todo** (icono de la barra superior → Quit) y vuelve a abrirlo.
4. En el capturador, pulsa **Comprobar conexión**.

Si el paso 3 no funciona, el capturador te ofrece el plan B: servir la página desde
`python3 -m http.server 8000` y abrirla en `http://localhost:8000/herramientas/capturador.html`.
Desde ahí Ollama la acepta sin configurar nada.

#### Qué modelo elegir según tu Mac

| RAM | Modelo | Qué esperar |
|---|---|---|
| 8 GB | `qwen3:4b` o `gemma3:4b` | ~20-40 s por pregunta. Redacta bien, pero se inventa datos con facilidad |
| 16 GB | `qwen3:8b` | Bastante más fiable, velocidad parecida |
| 32 GB o más | `qwen3:32b` / `gemma3:27b` | Ya se acerca a un modelo de pago para esta tarea |

Con 8 GB, cierra el resto de aplicaciones mientras genera: la RAM es unificada y el
modelo compite con todo lo demás.

#### Por qué va de una en una

La versión anterior enviaba lotes de 20 preguntas por llamada, y tenía sentido cuando
cada llamada costaba dinero. En local no cuesta nada, y un modelo de 4B pierde el hilo
enseguida en respuestas largas: mezcla explicaciones de preguntas distintas y rompe el
formato. Una pregunta por llamada es más lento en total, pero sale bien.

Por lo mismo no se le pide JSON, sino dos líneas etiquetadas `EXPLICACION:` y `EJEMPLO:`,
que es lo único que un modelo pequeño respeta de forma fiable. Si aun así se sale del
formato, esa pregunta se salta y se anota en el registro, sin pisar lo que ya hubiera.

> ### Lee esto antes de fiarte de lo que genere
>
> Un modelo de 4B **escribe con total seguridad cosas que son falsas**. Con cifras, pares
> de apriete, tolerancias y normativa se equivoca a menudo. Para un test de estudio eso es
> peor que no tener explicación: memorizarías el error.
>
> Por eso todo lo que genera queda marcado como **sin revisar**:
>
> - En el **Banco** aparece en rojo, y hay un filtro *Sin revisar* para ir a por ellas.
> - Al abrir la pregunta, un aviso y un botón **Revisada**. También se marca como revisada
>   sola si editas el texto a mano.
> - Al **exportar** se te recuerda cuántas quedan sin revisar.
> - En la app de test sale una etiqueta ámbar *sin revisar* junto a la explicación.
>
> Trátalo como un borrador que te ahorra escribir desde cero, no como apuntes.
> Contrasta siempre con los PDF de la academia.

### Llevar el banco a la app

Pestaña **Exportar** → **Descargar paquete data.zip**. Descomprime y copia la carpeta
`data` dentro de `public/`, sustituyendo la que hay. Luego:

```bash
git add public/data
git commit -m "Nuevas preguntas"
git push
```

GitHub reconstruye y publica solo en un par de minutos.

Haz también **Copia de seguridad del banco** de vez en cuando: es un único JSON con todo
el banco, y es lo que te salva si borras los datos del navegador.

---

## App 2 · La app de test

- **Nuevo test** — módulo completo o un tema suelto, y 10 / 25 / 50 / 100 / 150 / todas.
- **Corrección al instante** — verde si aciertas, rojo si fallas marcando además la
  correcta en verde, y debajo la explicación y el ejemplo.
- **Swipe** a izquierda y derecha para cambiar de pregunta, más botones. En el ordenador:
  teclas `1`-`4` para responder, flechas para navegar, `M` para marcar.
- **Marcar para después** con el icono de marcador, y un índice que las lista todas con
  filtros por marcadas, sin responder y falladas.
- **Repasar fallos** — una pregunta entra en la lista al fallarla y sale cuando la
  aciertas **dos veces seguidas**. Es repetición espaciada sencilla: no basta con acertar
  una vez de casualidad.
- **Modo estudio** — sólo lectura, con la correcta ya marcada y la explicación visible,
  para ir pasando con el dedo.
- **Estadísticas** por módulo e historial de tests.
- **Reanudar** un test dejado a medias.
- **Copia de seguridad** del progreso en Ajustes.

Todo el progreso se guarda en el navegador (`localStorage`). No hay cuentas ni servidor:
nada sale de tu dispositivo.

---

## Estructura del proyecto

```
test-automocion/
├── Panel.command                doble clic para abrirlo todo
├── panel/
│   ├── servidor.mjs             servidor local y API
│   ├── banco.mjs                lectura y escritura de public/data
│   └── ui.html                  la interfaz
├── herramientas/
│   ├── importar.mjs             importador de carpetas de capturas
│   ├── importador/
│   │   ├── imagen.mjs           lectura de PNG/JPG y detección del verde
│   │   ├── ocr.mjs              Tesseract con coordenadas por línea
│   │   ├── ocr-macos.mjs        Puente con el lector de macOS
│   │   ├── ocr-macos.swift      El programa que habla con Vision
│   │   ├── parseo.mjs           líneas + verde → pregunta
│   │   ├── pdf.mjs              texto del temario y búsqueda de pasajes
│   │   └── ollama.mjs           generación de explicación y ejemplo
│   ├── ejemplo/                 captura y PDF de muestra para las pruebas
│   ├── capturador.html          revisión y captura manual · doble clic
│   ├── probar-analizador.mjs    pruebas del analizador de texto
│   ├── probar-capturador.mjs    pruebas de la interfaz del capturador
│   ├── probar-ia.mjs            pruebas del flujo con Ollama
│   ├── probar-importador.mjs    pruebas del importador con la captura real
│   ├── probar-panel.mjs         pruebas de la API del panel
│   ├── probar-banco.mjs         pruebas del Banco pulsando de verdad
│   ├── probar-movil.mjs         pruebas del gesto y de la barra del móvil
│   ├── probar-macos.mjs         pruebas del lector de macOS
│   ├── ver-lectura.mjs          diagnóstico de una captura suelta
│   └── probar-app.mjs           pruebas de la app de test renderizada
├── public/
│   ├── data/
│   │   ├── manifest.json        qué módulos existen
│   │   └── preguntas/*.json     un archivo por módulo
│   └── icono*.png / icono.svg
├── src/
│   ├── lib/estructura.js        ← el temario vive aquí
│   ├── lib/banco.js             carga y filtrado de preguntas
│   ├── lib/almacen.js           progreso, marcadas, historial
│   ├── hooks/useSwipe.js
│   └── components/
└── .github/workflows/deploy.yml
```

### Formato de una pregunta

```json
{
  "id": "cfsd-0001",
  "moduloId": "cfsd",
  "modulo": "CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN",
  "submoduloId": "ruedas",
  "submodulo": "RUEDAS",
  "idExterno": "2778104",
  "pregunta": "En un neumático 205/55 R16, ¿qué indica el 55?",
  "opciones": ["…", "…", "…", "…"],
  "correcta": 2,
  "explicacion": "…",
  "ejemplo": "…",
  "revisado": true,
  "material": { "pdf": null, "pagina": null, "video": null, "minuto": null, "audio": null },
  "tags": []
}
```

El campo `material` ya está reservado aunque todavía no lo uses: cuando rellenes `pdf` y
`pagina`, o `video` y `minuto`, la app muestra sola los botones de enlace bajo la
explicación. Por eso conviene ir rellenándolo desde ya y no tener que rehacer el JSON.

### Añadir un módulo o un tema nuevo

Los submódulos se pueden crear sobre la marcha desde el capturador (campo *…o escribe uno
nuevo*). Para que salgan en el orden del temario, añádelos también a la lista
`submodulos` del módulo en **dos** sitios:

1. `src/lib/estructura.js`
2. la constante `ESTRUCTURA` al principio del `<script>` de `herramientas/capturador.html`

La app sólo muestra módulos y temas que tengan preguntas, así que no pasa nada por
declararlos antes de tenerlas.

---

## Comprobaciones

```bash
npm run probar    # 377 comprobaciones automáticas
npm run build     # que la app compila sin errores
```

Qué cubre cada bloque:

| Prueba | Qué comprueba |
|---|---|
| `probar-importador` | Contra una captura real: detección de la banda verde, identificador, unión de opciones de dos líneas, extracción del PDF y búsqueda de pasajes. Y que **no adivina la correcta cuando no hay verde** |
| `probar-panel` | Arranca el servidor de verdad: explorador de carpetas, importación completa, edición del banco y que no sirve archivos de fuera. Trabaja sobre una copia y la restaura |
| `probar-analizador` | Los formatos de texto pegado, incluido el de la academia |
| `probar-capturador` | La interfaz: modo rápido, duplicados, borrado en bloque, deshacer |
| `probar-ia` | El flujo con Ollama contra un servidor simulado, con Ollama caído y con un modelo que se sale del formato |
| `probar-banco` | El Banco montado en un navegador simulado: que la casilla no abra el editor, que escribir en una respuesta no la marque como correcta, quitar y añadir respuestas, y las acciones en bloque |
| `probar-macos` | El lector de macOS: la conversión de coordenadas de Vision y el agrupado de líneas en opciones |
| `probar-movil` | Lo que sólo falla con el dedo: el gesto de deslizar reproducido con eventos de puntero de verdad, y que se pueda salir del test sin la cabecera |
| `probar-app` | La app de test renderizada de verdad: responder, colores, swipe, marcar, resultados, estadísticas |

Si tocas el parseo, el OCR o las expresiones regulares, ejecútalo antes de fiarte.

### Aviso final

Las explicaciones generadas por el modelo local son una ayuda para no escribir desde cero,
**no una fuente fiable**. Todo lo que no hayas revisado tú aparece marcado como tal, dentro
y fuera de la app. Ante cualquier duda sobre valores, pares de apriete o procedimientos,
manda la documentación del fabricante y el material de la academia.

