export const PLAY_SOUND_SCRIPT = `#!/bin/bash
# play-sound.sh — Play a sound for a Claude Code hook event.
# Supports single files and variant directories with non-repeating shuffle.
# Usage: bash play-sound.sh <event-name>
# Env overrides (for testing):
#   CLAUDE_SOUNDS_DIR — sound directory (default: ~/.claude/sounds)
#   CLAUDE_SOUNDS_STATE_DIR — state file directory (default: /tmp)

SOUNDS_DIR="\${CLAUDE_SOUNDS_DIR:-\$HOME/.claude/sounds}"
STATE_DIR="\${CLAUDE_SOUNDS_STATE_DIR:-/tmp}"
EVENT="\$1"
EVENT_DIR="\$SOUNDS_DIR/\$EVENT"

[ -z "\$EVENT" ] && exit 0

if [ -d "\$EVENT_DIR" ]; then
  STATE_FILE="\$STATE_DIR/claude-sounds-\$PPID-\$EVENT"

  ALL_FILES=()
  for f in "\$EVENT_DIR"/*.{mp3,wav,aiff,aif,m4a,caf,aac,flac}; do
    [ -f "\$f" ] && ALL_FILES+=("$(basename "\$f")")
  done

  [ \${#ALL_FILES[@]} -eq 0 ] && exit 0

  CANDIDATES=()
  for fname in "\${ALL_FILES[@]}"; do
    if [ ! -f "\$STATE_FILE" ] || ! grep -qxF "\$fname" "\$STATE_FILE"; then
      CANDIDATES+=("\$fname")
    fi
  done

  if [ \${#CANDIDATES[@]} -eq 0 ]; then
    rm -f "\$STATE_FILE"
    CANDIDATES=("\${ALL_FILES[@]}")
  fi

  INDEX=\$((RANDOM % \${#CANDIDATES[@]}))
  CHOSEN="\${CANDIDATES[\$INDEX]}"

  afplay "\$EVENT_DIR/\$CHOSEN" 2>/dev/null
  echo "\$CHOSEN" >> "\$STATE_FILE"
else
  afplay "\$SOUNDS_DIR/\$EVENT".* 2>/dev/null
fi

if [ "\$EVENT" = "session-end" ]; then
  rm -f "\$STATE_DIR/claude-sounds-\$PPID-"* 2>/dev/null
fi

exit 0
`
