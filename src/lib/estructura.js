// ---------------------------------------------------------------------------
// Estructura del temario: Técnico Superior en Automoción
//
// ESTE ARCHIVO ES LA FUENTE DE LA VERDAD del árbol de módulos.
// Si añades un submódulo nuevo, añádelo aquí Y en herramientas/capturador.html
// (busca la constante ESTRUCTURA al principio del <script>).
//
// La app sólo muestra los submódulos que realmente tienen preguntas,
// así que puedes dejar listas vacías sin romper nada.
// ---------------------------------------------------------------------------

export const TITULACION = 'Técnico Superior en Automoción';

export const ESTRUCTURA = [
  {
    id: 'cfsd',
    nombre: 'CIRCUITOS DE FLUIDOS SUSPENSIÓN Y DIRECCIÓN',
    corto: 'Fluidos, suspensión y dirección',
    color: '#38bdf8',
    submodulos: [
      'SISTEMAS MECÁNICOS',
      'SISTEMAS NEUMÁTICOS E HIDRÁULICOS',
      'SUSPENSIÓN MECÁNICA E HIDRONEUMÁTICA',
      'SUSPENSIÓN ACTIVA',
      'EL SISTEMA DE DIRECCIÓN',
      'RUEDAS',
      'TEST PARCIAL',
      'DIAGNOSIS Y AVERÍAS',
      'Prácticas del módulo CFSD: Taller Automoción 1',
    ],
  },
  {
    id: 'stf',
    nombre: 'SISTEMAS DE TRANSMISIÓN Y FRENADO',
    corto: 'Transmisión y frenado',
    color: '#a78bfa',
    submodulos: [],
  },
  {
    id: 'mot',
    nombre: 'MOTORES',
    corto: 'Motores',
    color: '#f97316',
    submodulos: [],
  },
  {
    id: 'sam',
    nombre: 'SISTEMAS AUXILIARES DEL MOTOR',
    corto: 'Auxiliares del motor',
    color: '#fb7185',
    submodulos: [],
  },
  {
    id: 'sca',
    nombre: 'SISTEMAS DE CARGA Y ARRANQUE',
    corto: 'Carga y arranque',
    color: '#facc15',
    submodulos: [],
  },
  {
    id: 'cea',
    nombre: 'CIRCUITOS ELÉCTRICOS AUXILIARES',
    corto: 'Eléctricos auxiliares',
    color: '#4ade80',
    submodulos: [],
  },
  {
    id: 'ssc',
    nombre: 'SISTEMAS DE SEGURIDAD Y CONFORTABILIDAD',
    corto: 'Seguridad y confort',
    color: '#2dd4bf',
    submodulos: [],
  },
  {
    id: 'dau',
    nombre: 'DIAGNOSIS CON AUTODATA',
    corto: 'Diagnosis Autodata',
    color: '#c084fc',
    submodulos: [],
  },
  {
    id: 'veh',
    nombre: 'VEHÍCULOS ELÉCTRICOS, HÍBRIDOS Y DE HIDRÓGENO',
    corto: 'Eléctricos, híbridos e H₂',
    color: '#34d399',
    submodulos: [],
  },
  {
    id: 'epa',
    nombre: 'EJERCICIO PARCIAL',
    corto: 'Ejercicio parcial',
    color: '#94a3b8',
    submodulos: [],
  },
];

/** Convierte "SUSPENSIÓN ACTIVA" -> "suspension-activa" */
export function slug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function moduloPorId(id) {
  return ESTRUCTURA.find((m) => m.id === id) || null;
}

export const CANTIDADES = [10, 25, 50, 100, 150, 'todas'];
