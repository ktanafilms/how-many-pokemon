#!/bin/sh
# Publica el juego gratis en GitHub Pages (rama gh-pages con la versión web lista).
# Requiere haber iniciado sesión una vez: gh auth login
# Uso: sh tools/deploy.sh [nombre-del-repo]
set -e
cd "$(dirname "$0")/.."
REPO="${1:-how-many-pokemon}"
USER="$(gh api user --jq .login)"

if ! gh repo view "$USER/$REPO" >/dev/null 2>&1; then
  echo "Creando el repositorio $USER/$REPO…"
  gh repo create "$REPO" --public --description "How Many Pokémon? — fan game para navegador inspirado en How Many Dudes"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$USER/$REPO.git"
gh auth setup-git >/dev/null 2>&1 || true
git push -u origin main --tags

# Versión web (sólo lo que usa el juego) en la rama gh-pages
node tools/build_web.mjs
TMP="$(mktemp -d)"
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"
(
  cd "$TMP"
  git init -q -b gh-pages
  git add -A
  git -c user.name="ktana" -c user.email="ktanafilms@gmail.com" commit -q -m "Publicación $(date +%Y-%m-%d)"
  git push -q -f "https://github.com/$USER/$REPO.git" gh-pages
)
rm -rf "$TMP"

# Activar Pages desde la rama gh-pages (si ya estaba activo, se actualiza)
gh api -X POST "repos/$USER/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X PUT "repos/$USER/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true

echo "Publicado en: https://$USER.github.io/$REPO/ (puede tardar 1-2 minutos la primera vez)"
