# claude-sounds

Sound themes for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Get audio feedback on session start, task completion, errors, and more.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/thoamsy/claude-sounds/main/install.sh | bash
```

## Setup

```bash
# Inject sound hooks into Claude Code settings
claude-sounds init

# Import a theme from zip
claude-sounds import theme.zip

# Switch between themes
claude-sounds use
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

- **SessionStart** - session begins
- **Stop** - agent stops
- **PermissionRequest** - permission prompt
- **TaskCompleted** - task done
- **Error** - tool failure / permission denied
- **SubagentStop** - subagent finishes
- **Notification** - notification

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
```

Share themes by exporting as zip (`claude-sounds export`) and importing on another machine.
