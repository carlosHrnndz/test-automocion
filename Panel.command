#!/bin/bash
# Doble clic en este archivo para abrir el panel.
# Se abre una ventana de Terminal: déjala abierta mientras lo uses.

cd "$(dirname "$0")" || exit 1

echo ""
echo "  Test de Mecánica · abriendo el panel"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Falta Node.js. Descárgalo de https://nodejs.org (versión LTS) y vuelve a intentarlo."
  echo ""
  read -r -p "  Pulsa Enter para cerrar."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Primera vez: instalando lo necesario. Tarda un minuto…"
  echo ""
  npm install || {
    echo ""
    echo "  No se han podido instalar las dependencias."
    read -r -p "  Pulsa Enter para cerrar."
    exit 1
  }
fi

exec node panel/servidor.mjs
