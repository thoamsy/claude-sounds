# `claude-sounds init` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `init` and `uninit` commands that safely inject/remove sound hook entries in `~/.claude/settings.json` without destroying existing user hook logic.

**Architecture:** Extract a pure `hooks-config` module that reads/writes settings.json and handles all merge logic. The module operates on plain objects (no file I/O in the core logic) so it's fully unit-testable. `index.ts` calls the module and handles prompts/file I/O.

**Tech Stack:** Bun, TypeScript, `bun:test`

---

## File Structure

- **Create:** `src/hooks-config.ts` — pure functions for settings.json hook merging
- **Create:** `src/hooks-config.test.ts` — unit tests covering all scenarios
- **Create:** `src/constants.ts` — shared constants (hook names, labels, sound-to-event mapping)
- **Modify:** `index.ts` — extract constants to `src/constants.ts`, add `cmdInit()` and `cmdUninit()`, wire into CLI

## Key Data Structures

The settings.json `hooks` field structure:

```json
"hooks": {
  "Stop": [
    {
      "matcher": "optional-tool-filter",
      "hooks": [
        { "type": "command", "command": "afplay ~/.claude/sounds/stop.mp3" }
      ]
    }
  ]
}
```

Sound file to hook event mapping (one sound can map to multiple events):

```ts
const SOUND_TO_EVENTS: Record<string, string[]> = {
  "session-start": ["SessionStart"],
  "stop":          ["Stop"],
  "permission-request": ["PermissionRequest"],
  "task-completed": ["TaskCompleted"],
  "error":          ["PostToolUseFailure", "StopFailure", "PermissionDenied"],
  "subagent-stop":  ["SubagentStop"],
  "notification":   ["Notification"],
}
```

The marker to identify our hook entries: the command contains `~/.claude/sounds/`.

---

### Task 1: Extract constants to shared module

**Files:**
- Create: `src/constants.ts`
- Modify: `index.ts`

- [ ] **Step 1: Create `src/constants.ts`**

```ts
export const THEMES_DIR_NAME = "sound-themes"
export const SOUNDS_LINK_NAME = "sounds"
export const SOUND_MARKER = "~/.claude/sounds/"

export const HOOK_NAMES = [
  "session-start",
  "stop",
  "permission-request",
  "task-completed",
  "error",
  "subagent-stop",
  "notification",
] as const

export type HookName = (typeof HOOK_NAMES)[number]

export const HOOK_LABELS: Record<HookName, string> = {
  "session-start": "SessionStart",
  stop: "Stop",
  "permission-request": "PermissionRequest",
  "task-completed": "TaskCompleted",
  error: "Error (PostToolUseFailure / StopFailure / PermissionDenied)",
  "subagent-stop": "SubagentStop",
  notification: "Notification",
}

export const SOUND_TO_EVENTS: Record<HookName, string[]> = {
  "session-start": ["SessionStart"],
  stop: ["Stop"],
  "permission-request": ["PermissionRequest"],
  "task-completed": ["TaskCompleted"],
  error: ["PostToolUseFailure", "StopFailure", "PermissionDenied"],
  "subagent-stop": ["SubagentStop"],
  notification: ["Notification"],
}

export const ALL_SOUND_EVENTS = Object.values(SOUND_TO_EVENTS).flat()
```

- [ ] **Step 2: Update `index.ts` imports**

Replace the inline `HOOK_NAMES`, `HookName`, `HOOK_LABELS` definitions with imports from `src/constants.ts`. Remove the duplicated declarations. Keep all other code unchanged.

- [ ] **Step 3: Verify the CLI still works**

Run: `cd ~/Workspace/claude-sounds && bun run index.ts list`
Expected: lists themes as before

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts index.ts
git commit -m "refactor: extract constants to shared module"
```

---

### Task 2: Create `hooks-config` module with tests — `injectSoundHooks`

**Files:**
- Create: `src/hooks-config.ts`
- Create: `src/hooks-config.test.ts`

- [ ] **Step 1: Write failing tests for `injectSoundHooks`**

```ts
import { describe, expect, test } from "bun:test"
import { injectSoundHooks, removeSoundHooks } from "./hooks-config"

describe("injectSoundHooks", () => {
  test("adds hooks to empty settings (no hooks key)", () => {
    const settings = {}
    const result = injectSoundHooks(settings)

    expect(result.hooks).toBeDefined()
    expect(result.hooks.Stop).toBeArrayOfSize(1)
    expect(result.hooks.Stop[0].hooks[0].command).toContain("~/.claude/sounds/stop")
    expect(result.hooks.SessionStart).toBeArrayOfSize(1)
    expect(result.hooks.PostToolUseFailure).toBeArrayOfSize(1)
    expect(result.hooks.StopFailure).toBeArrayOfSize(1)
    expect(result.hooks.PermissionDenied).toBeArrayOfSize(1)
    // error.wav maps to 3 events, all should reference the same sound
    expect(result.hooks.PostToolUseFailure[0].hooks[0].command).toContain("error")
    expect(result.hooks.StopFailure[0].hooks[0].command).toContain("error")
    expect(result.hooks.PermissionDenied[0].hooks[0].command).toContain("error")
  })

  test("adds hooks when hooks object exists but target events are missing", () => {
    const settings = {
      hooks: {
        PostToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo hello" }],
          },
        ],
      },
    }
    const result = injectSoundHooks(settings)

    // preserves existing hook
    expect(result.hooks.PostToolUse).toEqual(settings.hooks.PostToolUse)
    // adds sound hooks
    expect(result.hooks.Stop).toBeArrayOfSize(1)
    expect(result.hooks.SessionStart).toBeArrayOfSize(1)
  })

  test("preserves existing user hooks on same event and appends sound hook", () => {
    const userHook = {
      hooks: [{ type: "command", command: "echo 'task done'" }],
    }
    const settings = {
      hooks: {
        Stop: [userHook],
      },
    }
    const result = injectSoundHooks(settings)

    // event should now have 2 entries: user's + sound
    expect(result.hooks.Stop).toBeArrayOfSize(2)
    expect(result.hooks.Stop[0]).toEqual(userHook)
    expect(result.hooks.Stop[1].hooks[0].command).toContain("~/.claude/sounds/stop")
  })

  test("is idempotent — does not duplicate sound hooks on repeated calls", () => {
    const settings = {}
    const first = injectSoundHooks(settings)
    const second = injectSoundHooks(first)

    expect(second.hooks.Stop).toBeArrayOfSize(1)
    expect(second.hooks.SessionStart).toBeArrayOfSize(1)
    expect(second.hooks.PostToolUseFailure).toBeArrayOfSize(1)
  })

  test("updates existing sound hooks if already present (idempotent replace)", () => {
    const settings = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: "afplay ~/.claude/sounds/stop.wav" },
            ],
          },
        ],
      },
    }
    const result = injectSoundHooks(settings)

    expect(result.hooks.Stop).toBeArrayOfSize(1)
    expect(result.hooks.Stop[0].hooks[0].command).toContain("~/.claude/sounds/stop")
  })

  test("preserves non-hooks settings fields", () => {
    const settings = {
      env: { FOO: "bar" },
      permissions: { allow: ["Bash"] },
      hooks: {},
    }
    const result = injectSoundHooks(settings)

    expect(result.env).toEqual({ FOO: "bar" })
    expect(result.permissions).toEqual({ allow: ["Bash"] })
  })

  test("handles event with mixed user + stale sound hook", () => {
    const userHook = {
      matcher: "Bash",
      hooks: [{ type: "command", command: "echo custom" }],
    }
    const staleSound = {
      hooks: [
        { type: "command", command: "afplay ~/.claude/sounds/stop.old.mp3" },
      ],
    }
    const settings = {
      hooks: {
        Stop: [userHook, staleSound],
      },
    }
    const result = injectSoundHooks(settings)

    // user hook preserved, stale sound replaced with fresh one
    expect(result.hooks.Stop).toBeArrayOfSize(2)
    expect(result.hooks.Stop[0]).toEqual(userHook)
    expect(result.hooks.Stop[1].hooks[0].command).toContain("~/.claude/sounds/stop")
    expect(result.hooks.Stop[1].hooks[0].command).not.toContain(".old")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Workspace/claude-sounds && bun test src/hooks-config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `injectSoundHooks`**

```ts
import { SOUND_TO_EVENTS, SOUND_MARKER, HOOK_NAMES, type HookName } from "./constants"

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

function soundFileForEvent(event: string): string | null {
  for (const [hookName, events] of Object.entries(SOUND_TO_EVENTS)) {
    if (events.includes(event)) {
      return hookName
    }
  }
  return null
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Workspace/claude-sounds && bun test src/hooks-config.test.ts`
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks-config.ts src/hooks-config.test.ts
git commit -m "feat: add hooks-config module with injectSoundHooks"
```

---

### Task 3: Add tests and implementation for `removeSoundHooks`

**Files:**
- Modify: `src/hooks-config.test.ts`

- [ ] **Step 1: Add failing tests for `removeSoundHooks`**

Append to `src/hooks-config.test.ts`:

```ts
describe("removeSoundHooks", () => {
  test("removes all sound hooks from settings", () => {
    const settings = injectSoundHooks({})
    const result = removeSoundHooks(settings)

    // all events were sound-only, so hooks should be empty/undefined
    expect(result.hooks).toBeUndefined()
  })

  test("preserves user hooks when removing sound hooks", () => {
    const userHook = {
      matcher: "Bash",
      hooks: [{ type: "command", command: "echo hello" }],
    }
    const settings = {
      hooks: {
        PostToolUse: [userHook],
        Stop: [
          userHook,
          { hooks: [{ type: "command", command: "afplay ~/.claude/sounds/stop.mp3" }] },
        ],
        SessionStart: [
          { hooks: [{ type: "command", command: "afplay ~/.claude/sounds/session-start.mp3" }] },
        ],
      },
    }
    const result = removeSoundHooks(settings)

    expect(result.hooks!.PostToolUse).toEqual([userHook])
    expect(result.hooks!.Stop).toEqual([userHook])
    expect(result.hooks!.SessionStart).toBeUndefined()
  })

  test("returns settings unchanged when no hooks exist", () => {
    const settings = { env: { FOO: "1" } }
    const result = removeSoundHooks(settings)

    expect(result).toEqual(settings)
  })

  test("returns settings unchanged when no sound hooks present", () => {
    const userHook = {
      hooks: [{ type: "command", command: "echo test" }],
    }
    const settings = {
      hooks: { Stop: [userHook] },
    }
    const result = removeSoundHooks(settings)

    expect(result.hooks!.Stop).toEqual([userHook])
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd ~/Workspace/claude-sounds && bun test src/hooks-config.test.ts`
Expected: all 11 tests PASS (implementation was already done in Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/hooks-config.test.ts
git commit -m "test: add removeSoundHooks tests"
```

---

### Task 4: Wire `init` and `uninit` commands into CLI

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: Add `cmdInit` function**

```ts
import { injectSoundHooks, removeSoundHooks } from "./src/hooks-config"
import { readFile, writeFile } from "fs/promises"

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json")

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(SETTINGS_PATH, "utf-8")
    return JSON.parse(text)
  } catch {
    return {}
  }
}

async function writeSettings(settings: Record<string, unknown>) {
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n")
}

async function cmdInit() {
  const settings = await readSettings()
  const updated = injectSoundHooks(settings)
  await writeSettings(updated)
  p.log.success("Sound hooks injected into settings.json")
}
```

- [ ] **Step 2: Add `cmdUninit` function**

```ts
async function cmdUninit() {
  const settings = await readSettings()
  const updated = removeSoundHooks(settings)
  await writeSettings(updated)
  p.log.success("Sound hooks removed from settings.json")
}
```

- [ ] **Step 3: Wire into command routing**

Add to the command dispatch block in `main()`:

```ts
if (command === "init") return cmdInit()
if (command === "uninit") return cmdUninit()
```

Add to the interactive menu options:

```ts
{ value: "init", label: "Setup hooks", hint: "inject sound hooks into settings.json" },
{ value: "uninit", label: "Remove hooks", hint: "remove sound hooks from settings.json" },
```

Add to the switch:

```ts
case "init":
  await cmdInit()
  break
case "uninit":
  await cmdUninit()
  break
```

- [ ] **Step 4: Verify init works**

Run: `cd ~/Workspace/claude-sounds && bun run index.ts init`
Expected: "Sound hooks injected into settings.json"

Then verify settings.json still has all existing non-sound config (env, permissions, statusLine, etc.) and sound hooks are present.

- [ ] **Step 5: Verify uninit works**

Run: `cd ~/Workspace/claude-sounds && bun run index.ts uninit`
Expected: "Sound hooks removed from settings.json"

Then verify settings.json still has PostToolUse git push hook and all non-hook config intact, but all sound hooks are gone.

- [ ] **Step 6: Verify init is idempotent**

Run: `cd ~/Workspace/claude-sounds && bun run index.ts init && bun run index.ts init`

Check settings.json — should have exactly one sound hook entry per event, not duplicates.

- [ ] **Step 7: Commit**

```bash
git add index.ts
git commit -m "feat: add init/uninit commands for settings.json hook management"
```

---

## Verification

End-to-end test sequence:

1. `bun test` — all unit tests pass
2. `claude-sounds uninit` — removes sound hooks, PostToolUse git push hook survives
3. `claude-sounds init` — re-adds sound hooks, PostToolUse git push hook still there
4. `claude-sounds init` again — idempotent, no duplicates
5. Manually add a custom hook to `Stop` event in settings.json, then `claude-sounds init` — custom hook preserved, sound hook appended
