
#!/usr/bin/env bash

set -euo pipefail

echo "======================================"
echo "  QR PIEDRAS EMPRESARIAL"
echo "  Configurando DevContainer..."
echo "======================================"

cd /workspaces/qr-piedras-empresarial

echo "1. Verificando Node.js..."
node --version
npm --version

echo "2. Instalando Git LFS..."

if ! command -v git-lfs >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y git-lfs
fi

git lfs install

echo "3. Verificando Git..."
git --version
git lfs version

echo "4. Verificando GitHub CLI..."
gh --version

echo "5. Instalando dependencias React..."

if [ -f package.json ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
else
  echo "No existe package.json."
  echo "No se instalarán dependencias npm."
fi

echo "6. Configurando variables de entorno..."

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
  echo "Se creó .env.local desde .env.example."
  echo "Recuerda completar tus valores de Supabase."
fi

echo "7. Verificando configuración..."

if [ -f .env.local ]; then
  echo "Archivo .env.local encontrado."
else
  echo "Pendiente: crear .env.local."
fi

echo "======================================"
echo "  DEVCONTAINER CONFIGURADO"
echo "======================================"
echo ""
echo "Para iniciar QR Piedras:"
echo "npm run dev -- --host 0.0.0.0"
