# Import/Export Design

## Context

claude-sounds manages sound themes in `~/.claude/sound-themes/`, each theme being a flat directory of 7 audio files named by hook. Users want to share themes with friends via file transfer (WeChat, Telegram, etc.) and quickly import themes they receive.

## Design

### Export

```bash
claude-sounds export [theme-name]
```

- No argument: exports the currently active theme
- Outputs `~/Downloads/<theme-name>.zip`
- Zip contains flat audio files (no nested directory)
- Uses macOS built-in `zip` command, no extra dependencies

### Import

```bash
claude-sounds import <path-to-zip>
```

- Accepts a file path (supports drag-and-drop into terminal)
- Theme name derived from zip filename (minus `.zip` extension)
- Path cleaning: strips escaped spaces, surrounding quotes
- If theme already exists, prompt: Overwrite / Rename / Cancel
- After import, prompt: switch to new theme now?
- Uses macOS built-in `unzip` command, no extra dependencies

### Zip Internal Structure

Flat file layout, no subdirectory:

```
duolingo.zip
  ├── session-start.mp3
  ├── stop.mp3
  ├── permission-request.wav
  ├── task-completed.mp3
  ├── error.wav
  ├── subagent-stop.mp3
  └── notification.mp3
```

### Conflict Resolution Flow

```
Theme "X" already exists
  -> Overwrite: remove existing, extract in place
  -> Rename: prompt for new name, extract to that directory
  -> Cancel: abort
```

## Files to Modify

- `index.ts` — add `cmdExport()`, `cmdImport()`, wire into `main()` command routing and interactive menu

## Verification

- `claude-sounds export duolingo` produces `~/Downloads/duolingo.zip`
- `unzip -l ~/Downloads/duolingo.zip` shows flat audio files
- `claude-sounds import ~/Downloads/duolingo.zip` with a fresh name creates a new theme
- `claude-sounds import` with an existing name shows conflict prompt
- `claude-sounds list` confirms the imported theme appears
