#!/usr/bin/env bash
# Inicializa Git local e publica este app em um repositório PRIVADO no GitHub.
# Pré-requisito: gh auth login
set -euo pipefail

REPO_NAME="${1:-solar-calculator}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -d .git ]; then
  echo "Já existe um repositório Git em $ROOT_DIR"
else
  git init
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin já configurado: $(git remote get-url origin)"
else
  echo "Criando repositório privado: $REPO_NAME"
  gh repo create "$REPO_NAME" \
    --private \
    --source=. \
    --remote=origin \
    --description "Solar Calculator — app Android de dimensionamento fotovoltaico rápido"
fi

git add .
git status

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  git commit -m "chore: update Solar Calculator app" || true
else
  git commit -m "Initial commit: Solar Calculator app (Expo + TypeScript)"
fi

git push -u origin main
echo "✅ Código enviado para origin/main"
gh repo view --web
