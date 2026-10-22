#!/bin/sh
# Publica el juego gratis en GitHub Pages. Requiere haber iniciado sesión una vez: gh auth login
# Uso: sh tools/deploy.sh [nombre-del-repo]
set -e
cd "$(dirname "$0")/.."
REPO="${1:-how-many-pokemon}"
USER="$(gh api user --jq .login)"

if ! gh repo view "$USER/$REPO" >/dev/null 2>&1; then
  echo "Creando el repositorio $USER/$REPO…"
  gh repo create "$REPO" --public --source . --remote origin --description "How Many Pokémon? — fan game para navegador"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$USER/$REPO.git"
git push -u origin main --tags

# Activar GitHub Pages con despliegue por GitHub Actions
gh api -X POST "repos/$USER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$USER/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || true
gh workflow run pages.yml --repo "$USER/$REPO" >/dev/null 2>&1 || true

echo "Esperando a que termine la publicación…"
sleep 10
RUN="$(gh run list --repo "$USER/$REPO" --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
[ -n "$RUN" ] && gh run watch "$RUN" --repo "$USER/$REPO" --exit-status
echo "Publicado en: https://$USER.github.io/$REPO/"
