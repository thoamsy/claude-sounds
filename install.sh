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

# Fetch latest release tag
if [ -n "${VERSION:-}" ]; then
  tag="$VERSION"
else
  tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d '"' -f 4)"
fi

if [ -z "$tag" ]; then
  echo "Failed to determine latest version"
  exit 1
fi

echo "Installing ${BINARY_NAME} ${tag}..."

# Download binary
url="https://github.com/${REPO}/releases/download/${tag}/${BINARY_NAME}-${target}"
tmpfile="$(mktemp)"
curl -fsSL -o "$tmpfile" "$url"
chmod +x "$tmpfile"

# Install
if [ -w "$INSTALL_DIR" ]; then
  mv "$tmpfile" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "Need sudo to install to ${INSTALL_DIR}"
  sudo mv "$tmpfile" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Installed ${BINARY_NAME} ${tag} to ${INSTALL_DIR}/${BINARY_NAME}"
echo ""
echo "Run 'claude-sounds init' to set up sound hooks in Claude Code."
