#!/usr/bin/env bash
set -euo pipefail

REPO="thoamsy/claude-sounds"
BINARY_NAME="claude-sounds"
INSTALL_DIR="/usr/local/bin"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)  arch="x64" ;;
  arm64|aarch64)  arch="arm64" ;;
  *)              echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

target="${os}-${arch}"
echo "Detected platform: ${target}"

# Build download URL
if [ -n "${VERSION:-}" ]; then
  path="${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${target}"
  echo "Installing ${BINARY_NAME} ${VERSION}..."
else
  path="${REPO}/releases/latest/download/${BINARY_NAME}-${target}"
  echo "Installing ${BINARY_NAME} (latest)..."
fi

# Try GitHub directly, fall back to mirror for regions with connectivity issues
tmpfile="$(mktemp)"
if ! curl -fsSL --connect-timeout 10 -o "$tmpfile" "https://github.com/${path}" 2>/dev/null; then
  echo "GitHub download failed, trying mirror..."
  curl -fsSL -o "$tmpfile" "https://ghp.ci/https://github.com/${path}"
fi
chmod +x "$tmpfile"

# macOS: remove quarantine flag and ad-hoc codesign
if [ "$OS" = "Darwin" ]; then
  xattr -d com.apple.quarantine "$tmpfile" 2>/dev/null || true
  codesign --force --sign - "$tmpfile" 2>/dev/null || true
fi

# Install
if [ -w "$INSTALL_DIR" ]; then
  mv "$tmpfile" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "Need sudo to install to ${INSTALL_DIR}"
  sudo mv "$tmpfile" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Installed ${BINARY_NAME} to ${INSTALL_DIR}/${BINARY_NAME}"
echo ""
echo "Run 'claude-sounds init' to set up sound hooks in Claude Code."
