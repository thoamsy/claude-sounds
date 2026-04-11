export const THEMES_DIR_NAME = "sound-themes"
export const SOUNDS_LINK_NAME = "sounds"
export const SOUND_MARKER = "~/.claude/sounds/"
export const PLAY_SCRIPT_MARKER = "~/.claude/play-sound.sh"

export const HOOK_NAMES = [
  "session-start",
  "session-end",
  "stop",
  "permission-request",
  "task-completed",
  "error",
  "tool-use",
  "subagent-start",
  "subagent-stop",
  "pre-compact",
  "post-compact",
  "worktree-create",
  "worktree-remove",
  "notification",
  "config-change",
] as const

export type HookName = (typeof HOOK_NAMES)[number]

export const HOOK_LABELS: Record<HookName, string> = {
  "session-start": "SessionStart",
  "session-end": "SessionEnd",
  stop: "Stop",
  "permission-request": "PermissionRequest",
  "task-completed": "TaskCompleted",
  error: "Error (PostToolUseFailure / StopFailure / PermissionDenied)",
  "tool-use": "PostToolUse",
  "subagent-start": "SubagentStart",
  "subagent-stop": "SubagentStop",
  "pre-compact": "PreCompact",
  "post-compact": "PostCompact",
  "worktree-create": "WorktreeCreate",
  "worktree-remove": "WorktreeRemove",
  notification: "Notification",
  "config-change": "ConfigChange",
}

export const SOUND_TO_EVENTS: Record<HookName, string[]> = {
  "session-start": ["SessionStart"],
  "session-end": ["SessionEnd"],
  stop: ["Stop"],
  "permission-request": ["PermissionRequest"],
  "task-completed": ["TaskCompleted"],
  error: ["PostToolUseFailure", "StopFailure", "PermissionDenied"],
  "tool-use": ["PostToolUse"],
  "subagent-start": ["SubagentStart"],
  "subagent-stop": ["SubagentStop"],
  "pre-compact": ["PreCompact"],
  "post-compact": ["PostCompact"],
  "worktree-create": ["WorktreeCreate"],
  "worktree-remove": ["WorktreeRemove"],
  notification: ["Notification"],
  "config-change": ["ConfigChange"],
}

export const ALL_SOUND_EVENTS = Object.values(SOUND_TO_EVENTS).flat()
