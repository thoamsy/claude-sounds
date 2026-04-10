#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist

targets=(
  "bun-darwin-arm64:claude-sounds-darwin-arm64"
  "bun-darwin-x64:claude-sounds-darwin-x64"
  "bun-linux-x64:claude-sounds-linux-x64"
  "bun-linux-arm64:claude-sounds-linux-arm64"
)

for entry in "${targets[@]}"; do
  target="${entry%%:*}"
  output="${entry##*:}"
  echo "Building ${output} (${target})..."
  bun build ./index.ts --compile --target="$target" --outfile "dist/${output}"
done

echo "Done. Binaries in dist/"
ls -lh dist/
