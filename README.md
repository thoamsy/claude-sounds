# claude-sounds

Sound themes for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Get audio feedback on session start, task completion, errors, and more.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/thoamsy/claude-sounds/main/install.sh | bash
```

## Setup

```bash
# Import a theme and start using it (hooks are injected automatically)
claude-sounds import theme.zip

# Or set up hooks manually
claude-sounds init
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Inject sound hooks into `~/.claude/settings.json` |
| `uninit` | Remove sound hooks |
| `use` | Switch active theme |
| `edit` | Replace individual sounds in current theme |
| `list` | List all themes and their sounds |
| `preview` | Preview a sound |
| `export` | Export theme as zip to `~/Downloads` |
| `import` | Import theme from zip |

Run `claude-sounds` without arguments for interactive mode.

## Sound events

| Event | Trigger |
|-------|---------|
| **SessionStart** | Session begins |
| **Stop** | Agent stops |
| **PermissionRequest** | Permission prompt appears |
| **TaskCompleted** | Task done |
| **Error** | Tool failure / permission denied |
| **SubagentStop** | Subagent finishes |
| **Notification** | Notification |
| **ConfigChange** | Settings file changes (e.g. theme switch) |

Missing sound files are silently skipped, so not every theme needs all events.

## Theme structure

Themes live in `~/.claude/sound-themes/{name}/`. Each theme is a folder of audio files named by event:

```
~/.claude/sound-themes/my-theme/
  session-start.mp3
  stop.mp3
  permission-request.mp3
  task-completed.mp3
  error.mp3
  subagent-stop.mp3
  notification.mp3
  config-change.mp3    # optional
```

Any audio format supported by `afplay` works (mp3, wav, aiff, etc.).

Share themes by exporting as zip (`claude-sounds export`) and importing on another machine.
