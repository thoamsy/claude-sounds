export const THEMES_DIR_NAME = "sound-themes"
export const SOUNDS_LINK_NAME = "sounds"
export const SOUND_MARKER = "~/.claude/sounds/"
export const PLAY_SCRIPT_MARKER = "~/.claude/play-sound.sh"

export const HOOK_NAMES = [
  "session-start",
  "stop",
  "permission-request",
  "task-completed",
  "error",
  "subagent-start",
  "subagent-stop",
  "notification",
  "config-change",
] as const

export type HookName = (typeof HOOK_NAMES)[number]

export const HOOK_LABELS: Record<HookName, string> = {
  "session-start": "SessionStart",
  stop: "Stop",
  "permission-request": "PermissionRequest",
  "task-completed": "TaskCompleted",
  error: "Error (PostToolUseFailure / StopFailure / PermissionDenied)",
  "subagent-start": "SubagentStart",
  "subagent-stop": "SubagentStop",
  notification: "Notification",
  "config-change": "ConfigChange",
}

export const SOUND_TO_EVENTS: Record<HookName, string[]> = {
  "session-start": ["SessionStart"],
  stop: ["Stop"],
  "permission-request": ["PermissionRequest"],
  "task-completed": ["TaskCompleted"],
  error: ["PostToolUseFailure", "StopFailure", "PermissionDenied"],
  "subagent-start": ["SubagentStart"],
  "subagent-stop": ["SubagentStop"],
  notification: ["Notification"],
  "config-change": ["ConfigChange"],
}

export const ALL_SOUND_EVENTS = Object.values(SOUND_TO_EVENTS).flat()
