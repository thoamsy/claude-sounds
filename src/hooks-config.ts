import { SOUND_TO_EVENTS, SOUND_MARKER } from "./constants"

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
  return group.hooks.some((h) => h.command.includes(SOUND_MARKER))
}

function makeSoundHookGroup(soundFile: string): HookGroup {
  return {
    hooks: [
      {
        type: "command",
        command: `afplay ${SOUND_MARKER}${soundFile}`,
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
