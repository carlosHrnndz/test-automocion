# Prompts para extraer preguntas con un modelo de visión en Ollama

Dos formas de usarlo. **La de dos pasos da bastante mejor resultado** en modelos
pequeños: leer una imagen y razonar sobre mecánica a la vez es mucho pedir, y cuando
se le junta todo empieza a inventar.

---

## Antes de empezar

Comprueba que tu modelo **ve imágenes**. No todos los modelos de Ollama son multimodales:

```
ollama list
```

Si `gemma4` no acepta imágenes, prueba con `gemma3:4b`, que sí es multimodal y cabe
en 8 GB. Para pasarle una imagen desde el Terminal, la ruta va **dentro** del texto:

```
ollama run gemma3:4b "Transcribe esta imagen ./001.png"
```

Desde la aplicación de escritorio de Ollama basta con arrastrar la imagen al chat.

---

# PASO 1 · Transcribir la imagen

Pega esto y adjunta **una sola captura**.

```
Eres un transcriptor. Tu única tarea es copiar EXACTAMENTE lo que ves en la imagen.

La imagen es una pregunta de test de un curso de Automoción. Contiene:
- Una cabecera tipo "PREGUNTA: (Identificador nº 2778097)"
- El enunciado de la pregunta
- La palabra "RESPUESTAS"
- Entre 2 y 4 opciones de respuesta
- UNA de las opciones tiene FONDO VERDE: esa es la respuesta correcta

REGLAS QUE NO PUEDES SALTARTE:

1. Copia el texto LETRA POR LETRA. No corrijas faltas, no cambies palabras por
   sinónimos, no completes frases, no arregles la puntuación. Si la imagen pone
   "Los materiales pueden llegar a romperse", escribes exactamente eso.
2. Respeta tildes, eñes y mayúsculas tal como aparecen.
3. NO INVENTES NADA. Si una parte está borrosa o no la lees con seguridad, escribe
   [ILEGIBLE] en ese punto. Es MUCHO mejor un [ILEGIBLE] que una palabra inventada.
4. NO añadas opciones que no estén en la imagen. Cuenta las opciones antes de
   escribir: si ves 3, pon 3. Si ves 4, pon 4.
5. La opción correcta es LA QUE TIENE FONDO VERDE. No la que a ti te parezca
   correcta por tus conocimientos: la que está pintada de verde. Si ninguna tiene
   fondo verde, pon "correcta": null.
6. No incluyas en el texto el círculo del botón de selección ni el contador de
   página tipo "1 / 40".

Responde ÚNICAMENTE con este JSON, sin texto antes ni después, sin ```:

{
  "idExterno": "el número del identificador, o null si no aparece",
  "pregunta": "el enunciado completo, sin la palabra RESPUESTAS",
  "opciones": ["primera opción", "segunda opción", "tercera opción", "cuarta opción"],
  "correcta": 0,
  "confianza": "alta",
  "dudas": ""
}

Donde:
- "correcta" es la POSICIÓN de la opción con fondo verde, empezando a contar en 0.
  Si la verde es la primera pon 0, si es la segunda pon 1, la tercera 2, la cuarta 3.
- "confianza" es "alta" si has leído todo con claridad, "media" si has dudado en
  alguna palabra, "baja" si hay partes que no distingues bien.
- "dudas" es una frase corta explicando qué no te ha quedado claro, o "" si nada.
```

---

# PASO 2 · Escribir la explicación

Coge el JSON del paso anterior y pégalo aquí, **sin imagen**. Si tienes el temario en
texto, pégalo también donde se indica: el modelo se equivoca mucho menos cuando tiene
el material delante en vez de tirar de memoria.

```
Eres profesor de Automoción en España. Escribes para un alumno de Grado Superior.

TEMARIO DE REFERENCIA (si está vacío, explica el principio general):
[PEGA AQUÍ EL TROZO DEL TEMARIO QUE HABLE DEL ASUNTO, O DÉJALO VACÍO]

PREGUNTA:
[PEGA AQUÍ EL JSON DEL PASO 1]

Escribe una explicación y un ejemplo para esa pregunta.

REGLAS:
- La explicación: 2 o 3 frases sobre POR QUÉ la respuesta marcada es la correcta.
  Explica el principio físico o el funcionamiento. No repitas la respuesta con otras
  palabras. Si alguna opción incorrecta es un error típico, dilo en media frase.
- El ejemplo: 1 o 2 frases con un caso concreto de taller o de conducción. Que sea
  práctico y se recuerde, no una definición.
- Si el TEMARIO cubre el asunto, básate en él. Es la fuente buena.
- NO des cifras, medidas, pares de apriete ni artículos de normativa que no aparezcan
  en el temario. Si no estás seguro de un número, explica el principio sin darlo.
- Español de España. Tutea al alumno. Sin listas ni viñetas ni markdown.

Responde ÚNICAMENTE con este JSON, sin texto alrededor:

{
  "explicacion": "...",
  "ejemplo": "..."
}
```

---

# Todo de una vez (más rápido, menos fiable)

Si prefieres una sola pasada por imagen. Rellena los tres datos de arriba antes de
lanzarlo.

```
Eres profesor de Automoción en España y estás transcribiendo un banco de preguntas.

Estos datos son fijos para esta imagen:
- moduloId: cfsd
- modulo: CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN
- submodulo: SISTEMAS MECÁNICOS

PRIMERO transcribe la imagen. Copia el texto LETRA POR LETRA: no corrijas, no
parafrasees, no completes. Si algo no lo lees con seguridad escribe [ILEGIBLE]; es
mucho mejor que inventar. No añadas opciones que no estén: cuéntalas antes.

La opción con FONDO VERDE es la correcta. No la que tú creas correcta: la verde.
Si ninguna está en verde, pon "correcta": null.

DESPUÉS escribe la explicación y el ejemplo:
- explicacion: 2 o 3 frases sobre por qué esa respuesta es la correcta, explicando el
  principio o el funcionamiento.
- ejemplo: 1 o 2 frases con un caso de taller o de conducción.
- No des cifras, pares de apriete ni normativa de los que no estés seguro.
- Español de España, tuteando, sin markdown ni listas.

Responde ÚNICAMENTE con este JSON, sin texto alrededor y sin ```:

{
  "idExterno": "2778097",
  "moduloId": "cfsd",
  "modulo": "CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN",
  "submodulo": "SISTEMAS MECÁNICOS",
  "pregunta": "...",
  "opciones": ["...", "...", "...", "..."],
  "correcta": 3,
  "explicacion": "...",
  "ejemplo": "...",
  "confianza": "alta",
  "dudas": ""
}
```

---

# Cómo meter el resultado en la app

En el panel, pestaña **Pegar texto** → botón **Pegar JSON**. Pegas ahí lo que te haya
devuelto el modelo —una pregunta o varias entre corchetes— y entra en el banco.

Lo que la app rellena sola y no tienes que pedirle al modelo: el `id`, el
`submoduloId`, el bloque `material` y `revisado`. Todo lo que venga por esta vía queda
marcado **sin revisar**, igual que lo generado por el importador.

---

# Al revisar, mira estas tres cosas

Con un modelo de visión los errores son distintos a los del OCR: no ves letras
raras, ves frases correctas que no estaban en la imagen. Por eso conviene fijarse en:

1. **El número de opciones.** Si la imagen tenía 4 y el JSON trae 3 o 5, hay problema.
2. **Que `correcta` apunte a la verde.** Es el error más probable: el modelo tiende a
   marcar la que él cree correcta en vez de la que está pintada. Compruébalo con la
   captura delante.
3. **Los campos `confianza` y `dudas`.** Si dice "media" o "baja", esa pregunta hay
   que leerla entera contra la imagen.

Si al revisar unas cuantas ves que `correcta` falla a menudo, díme y le damos la
vuelta: el color verde se detecta por aritmética sobre los píxeles, sin
equivocarse nunca, y podemos usar eso para corregir lo que diga el modelo.
