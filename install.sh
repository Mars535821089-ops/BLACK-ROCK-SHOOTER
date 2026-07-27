#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ROOT/dist/blueflame"
TARGET="${CODEX_HOME:-$HOME/.codex}/pets/blueflame"

for file in pet.json spritesheet.webp; do
  if [[ ! -f "$SOURCE/$file" ]]; then
    echo "Missing required file: $SOURCE/$file" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$TARGET")"

if [[ -d "$TARGET" ]]; then
  BACKUP="${TARGET}.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$TARGET" "$BACKUP"
  echo "Previous version backed up to: $BACKUP"
fi

mkdir -p "$TARGET"
cp "$SOURCE/pet.json" "$SOURCE/spritesheet.webp" "$TARGET/"

echo "BLACK★ROCK SHOOTER installed to: $TARGET"
echo "Open Codex → Settings → Pets, refresh the list, then select BLACK★ROCK SHOOTER."
