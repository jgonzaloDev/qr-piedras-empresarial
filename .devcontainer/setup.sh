
#!/usr/bin/env bash
set -euo pipefail

echo "Preparando QR Piedras Empresarial..."

if [ ! -f package.json ]; then
  echo "Creando proyecto React + Vite..."
  npm create vite@latest . -- --template react
fi

echo "Instalando dependencias..."
npm install

npm install \
  @supabase/supabase-js \
  react-router-dom \
  lucide-react \
  jspdf \
  jspdf-autotable

echo "Configurando entorno..."

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local                                                                                                                                                                                                                                                                                                        
fi

echo "Verificando herramientas..."
node --version
npm --version
git --version

echo "QR Piedras Empresarial preparado."
