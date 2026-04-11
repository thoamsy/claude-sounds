import { describe, expect, test } from "bun:test"
import { injectSoundHooks, removeSoundHooks } from "./hooks-config"

describe("injectSoundHooks", () => {
  test("adds hooks to empty settings (no hooks key)", () => {
    const settings = {}
    const result = injectSoundHooks(settings)
    const hooks = result.hooks!

    expect(hooks).toBeDefined()
    expect(hooks.Stop).toBeArrayOfSize(1)
    expect(hooks.Stop![0]!.hooks[0]!.command).toContain("play-sound.sh stop")
    expect(hooks.SessionStart).toBeArrayOfSize(1)
    expect(hooks.PostToolUseFailure).toBeArrayOfSize(1)
    expect(hooks.StopFailure).toBeArrayOfSize(1)
    expect(hooks.PermissionDenied).toBeArrayOfSize(1)
    expect(hooks.PostToolUseFailure![0]!.hooks[0]!.command).toContain("error")
    expect(hooks.StopFailure![0]!.hooks[0]!.command).toContain("error")
    expect(hooks.PermissionDenied![0]!.hooks[0]!.command).toContain("error")
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
    const hooks = result.hooks!

    expect(hooks.PostToolUse).toEqual(settings.hooks.PostToolUse)
    expect(hooks.Stop).toBeArrayOfSize(1)
    expect(hooks.SessionStart).toBeArrayOfSize(1)
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
    const hooks = result.hooks!

    expect(hooks.Stop).toBeArrayOfSize(2)
    expect(hooks.Stop![0]).toEqual(userHook)
    expect(hooks.Stop![1]!.hooks[0]!.command).toContain("play-sound.sh stop")
  })

  test("is idempotent — does not duplicate sound hooks on repeated calls", () => {
    const settings = {}
    const first = injectSoundHooks(settings)
    const second = injectSoundHooks(first)
    const hooks = second.hooks!

    expect(hooks.Stop).toBeArrayOfSize(1)
    expect(hooks.SessionStart).toBeArrayOfSize(1)
    expect(hooks.PostToolUseFailure).toBeArrayOfSize(1)
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
    const hooks = result.hooks!

    expect(hooks.Stop).toBeArrayOfSize(1)
    expect(hooks.Stop![0]!.hooks[0]!.command).toContain("play-sound.sh stop")
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
    const hooks = result.hooks!

    expect(hooks.Stop).toBeArrayOfSize(2)
    expect(hooks.Stop![0]).toEqual(userHook)
    expect(hooks.Stop![1]!.hooks[0]!.command).toContain("play-sound.sh stop")
    expect(hooks.Stop![1]!.hooks[0]!.command).not.toContain(".old")
  })
})

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

  test("removeSoundHooks cleans up old afplay-format hooks", () => {
    const settings = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: "afplay ~/.claude/sounds/stop.* 2>/dev/null || true" },
            ],
          },
        ],
      },
    }

    const result = removeSoundHooks(settings)
    expect(result.hooks).toBeUndefined()
  })

  test("removeSoundHooks cleans up new play-sound.sh-format hooks", () => {
    const settings = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: "bash ~/.claude/play-sound.sh stop 2>/dev/null || true" },
            ],
          },
        ],
      },
    }

    const result = removeSoundHooks(settings)
    expect(result.hooks).toBeUndefined()
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
