
# claude-sounds

Sound themes for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Get audio feedback on session start, task completion, errors, and more.

https://github.com/user-attachments/assets/9ce150d4-6577-489b-a363-6182cc0d36ad

## Install

```bash
brew install thoamsy/tap/claude-sounds
```

## Setup

> **Note:** claude-sounds does not ship with any built-in themes. You need to provide your own `.zip` theme file before running `import`.

Download a sample theme to get started:

- [duolingo.zip](https://github.com/thoamsy/claude-sounds/releases/download/v0.2.0/duolingo.zip) — Duolingo-style sounds
- [meme.zip](https://github.com/thoamsy/claude-sounds/releases/download/v0.2.0/meme.zip) — Meme sound effects

Or create your own (see [Theme structure](#theme-structure) below).

```bash
# Import a downloaded theme
claude-sounds import ~/Downloads/duolingo.zip

# Or create a theme manually, then set up hooks
# 1. Put your audio files in ~/.claude/sound-themes/my-theme/
# 2. Run init to inject hooks
claude-sounds init
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Inject sound hooks (global or per-project) |
| `uninit` | Remove sound hooks |
| `use` | Switch active theme |
| `edit` | Replace sounds or manage variants (supports file and folder drag) |
| `list` | List all themes and their sounds |
| `preview` | Preview a sound |
| `export` | Export theme as zip to `~/Downloads` |
| `import` | Import theme from zip |
| `version` | Print current version |

Run `claude-sounds` without arguments for interactive mode.

## Sound events

| Event | Trigger |
|-------|---------|
| **SessionStart** | Session begins |
| **SessionEnd** | Session exits |
| **Stop** | Agent stops (per-turn) |
| **PermissionRequest** | Permission prompt appears |
| **TaskCompleted** | Task done |
| **Error** | Tool failure / permission denied |
| **PostToolUse** | Tool call succeeds |
| **SubagentStart** | Subagent spawns |
| **SubagentStop** | Subagent finishes |
| **PreCompact** | Context compaction starts |
| **PostCompact** | Context compaction finishes |
| **WorktreeCreate** | Worktree created |
| **WorktreeRemove** | Worktree removed |
| **Notification** | Notification |
| **ConfigChange** | Settings file changes (e.g. theme switch) |

Missing sound files are silently skipped, so not every theme needs all events.

## Theme structure

Themes live in `~/.claude/sound-themes/{name}/`. Each theme is a folder of audio files named by event:

```
~/.claude/sound-themes/my-theme/
  session-start.mp3
  stop.mp3
  error.mp3
  ...
```

To add random variants for an event, use a directory instead of a single file:

```
~/.claude/sound-themes/my-theme/
  stop/
    coin.mp3
    ding.mp3
    chime.mp3
  error.mp3
```

When a directory is present, a random variant is played each time (non-repeating within a session). You can mix single files and variant directories in the same theme.

Any audio format supported by `afplay` works (mp3, wav, aiff, m4a, aac, flac, etc.).

Share themes by exporting as zip (`claude-sounds export`) and importing on another machine.
