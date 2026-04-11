import { PLAY_SCRIPT_MARKER, SOUND_MARKER, SOUND_TO_EVENTS } from "./constants"

interface HookCommand {
  type: string
  command: string
  timeout?: number
  statusMessage?: string
}

interface HookGroup {
  matcher?: string
  hooks: HookCommand[]
}

type HooksMap = Record<string, HookGroup[]>

interface Settings {
  hooks?: HooksMap
  [key: string]: unknown
}

function isSoundHook(group: HookGroup): boolean {
  return group.hooks.some(
    (h) => h.command.includes(SOUND_MARKER) || h.command.includes(PLAY_SCRIPT_MARKER)
  )
}

function makeSoundHookGroup(soundFile: string): HookGroup {
  return {
    hooks: [
      {
        type: "command",
        command: `bash ${PLAY_SCRIPT_MARKER} ${soundFile} 2>/dev/null || true`,
      },
    ],
  }
}

export function injectSoundHooks(settings: Settings): Settings {
  const hooks: HooksMap = { ...(settings.hooks ?? {}) }

  for (const [hookName, events] of Object.entries(SOUND_TO_EVENTS)) {
    for (const event of events) {
      const existing = hooks[event] ?? []
      const userHooks = existing.filter((g) => !isSoundHook(g))
      const soundGroup = makeSoundHookGroup(hookName)
      hooks[event] = [...userHooks, soundGroup]
    }
  }

  return { ...settings, hooks }
}

export function hasSoundHooks(settings: Settings): boolean {
  if (!settings.hooks) return false
  return Object.values(settings.hooks).some((groups) =>
    groups.some((g) => isSoundHook(g))
  )
}

export function removeSoundHooks(settings: Settings): Settings {
  if (!settings.hooks) return settings

  const hooks: HooksMap = {}

  for (const [event, groups] of Object.entries(settings.hooks)) {
    const userHooks = groups.filter((g) => !isSoundHook(g))
    if (userHooks.length > 0) {
      hooks[event] = userHooks
    }
  }

  return {
    ...settings,
    hooks: Object.keys(hooks).length > 0 ? hooks : undefined,
  }
}
