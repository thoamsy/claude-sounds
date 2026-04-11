# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

claude-sounds is a macOS CLI tool that adds sound themes to Claude Code hooks. It injects hook commands into `~/.claude/settings.json` that invoke a bash script (`~/.claude/play-sound.sh`) to play audio via `afplay`.

**macOS only** — uses `afplay` for audio playback. Do not add cross-platform support or suggest alternative audio players.

## Bun

Use Bun exclusively. Never use Node.js, npm, yarn, pnpm, vite, or dotenv.

- `bun <file>` to run, `bun test` to test, `bun install` to install
- `bunx <pkg>` instead of `npx`
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Prefer `Bun.spawn`/`Bun.spawnSync` over execa

## Commands

- **Test:** `bun test`
- **Build:** `bun build ./index.ts --compile --outfile dist/claude-sounds`
- **Run dev:** `bun index.ts`

## Architecture

- `index.ts` — main CLI entrypoint (interactive prompts via @clack/prompts, colors via picocolors)
- `src/constants.ts` — hook names, event mappings (`SOUND_TO_EVENTS`), labels
- `src/hooks-config.ts` — inject/remove/detect sound hooks in settings.json
- `src/play-script.ts` — bash script string for playing sounds (supports single files and variant directories with non-repeating shuffle)

Key concepts:
- **Themes** live in `~/.claude/sound-themes/{name}/`, active theme is a symlink at `~/.claude/sounds/`
- **Variant directories** — a hook can have a folder of audio files instead of a single file; the bash script plays them randomly without repeating within a session
- **Hook injection** — `injectSoundHooks()` writes hook entries into settings.json that call `bash ~/.claude/play-sound.sh <event-name>`
- One sound name can map to multiple Claude Code events (e.g., `"error"` → `PostToolUseFailure`, `StopFailure`, `PermissionDenied`)
