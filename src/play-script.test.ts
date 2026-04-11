import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { PLAY_SOUND_SCRIPT } from "./play-script"

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "claude-sounds-test-"))
  const soundsDir = join(root, "sounds")
  const binDir = join(root, "bin")
  const logFile = join(root, "afplay.log")
  const stateDir = join(root, "state")
  const scriptFile = join(root, "play-sound.sh")

  await mkdir(soundsDir, { recursive: true })
  await mkdir(binDir)
  await mkdir(stateDir)

  await writeFile(
    join(binDir, "afplay"),
    `#!/bin/bash
echo "$1" >> "${logFile}"
`
  )
  await chmod(join(binDir, "afplay"), 0o755)

  await writeFile(scriptFile, PLAY_SOUND_SCRIPT)
  await chmod(scriptFile, 0o755)

  return { root, soundsDir, binDir, logFile, stateDir, scriptFile }
}

function run(scriptFile: string, event: string, env: Record<string, string>) {
  return Bun.spawnSync(["bash", scriptFile, event], {
    env: { ...env, HOME: "/tmp/nonexistent" },
  })
}

async function getLog(logFile: string): Promise<string[]> {
  try {
    const content = await readFile(logFile, "utf-8")
    return content.trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

describe("play-sound.sh", () => {
  let cleanup: string[] = []

  afterEach(async () => {
    for (const dir of cleanup) {
      await rm(dir, { recursive: true, force: true })
    }
    cleanup = []
  })

  test("single file: plays event file via glob fallback", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    await writeFile(join(soundsDir, "stop.mp3"), "fake")

    run(scriptFile, "stop", {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    })

    const log = await getLog(logFile)
    expect(log).toHaveLength(1)
    expect(log[0]).toContain("stop.mp3")
  })

  test("variant directory: plays a file from the directory", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    const stopDir = join(soundsDir, "stop")
    await mkdir(stopDir)
    await writeFile(join(stopDir, "coin.mp3"), "fake")
    await writeFile(join(stopDir, "ding.mp3"), "fake")

    run(scriptFile, "stop", {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    })

    const log = await getLog(logFile)
    expect(log).toHaveLength(1)
    expect(["coin.mp3", "ding.mp3"].some((f) => log[0]!.endsWith(f))).toBe(true)
  })

  test("non-repeating: plays all variants before reshuffling", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    const stopDir = join(soundsDir, "stop")
    await mkdir(stopDir)
    await writeFile(join(stopDir, "a.mp3"), "fake")
    await writeFile(join(stopDir, "b.mp3"), "fake")
    await writeFile(join(stopDir, "c.mp3"), "fake")

    const env = {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    }

    run(scriptFile, "stop", env)
    run(scriptFile, "stop", env)
    run(scriptFile, "stop", env)

    const log = await getLog(logFile)
    expect(log).toHaveLength(3)

    const basenames = log.map((line) => line.split("/").pop()!)
    const unique = new Set(basenames)
    expect(unique.size).toBe(3)
  })

  test("resets after all variants played", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    const stopDir = join(soundsDir, "stop")
    await mkdir(stopDir)
    await writeFile(join(stopDir, "a.mp3"), "fake")
    await writeFile(join(stopDir, "b.mp3"), "fake")

    const env = {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    }

    run(scriptFile, "stop", env)
    run(scriptFile, "stop", env)
    run(scriptFile, "stop", env)

    const log = await getLog(logFile)
    expect(log).toHaveLength(3)
    expect(log[0]).not.toBe(log[1])
  })

  test("directory takes precedence over same-name file", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    await writeFile(join(soundsDir, "stop.mp3"), "fake-single")
    const stopDir = join(soundsDir, "stop")
    await mkdir(stopDir)
    await writeFile(join(stopDir, "variant.mp3"), "fake-variant")

    run(scriptFile, "stop", {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    })

    const log = await getLog(logFile)
    expect(log).toHaveLength(1)
    expect(log[0]).toContain("variant.mp3")
  })

  test("empty event name exits silently", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    const result = run(scriptFile, "", {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    })

    expect(result.exitCode).toBe(0)
    const log = await getLog(logFile)
    expect(log).toHaveLength(0)
  })

  test("empty variant directory exits silently", async () => {
    const { root, soundsDir, binDir, logFile, stateDir, scriptFile } = await setup()
    cleanup.push(root)

    await mkdir(join(soundsDir, "stop"))

    const result = run(scriptFile, "stop", {
      CLAUDE_SOUNDS_DIR: soundsDir,
      CLAUDE_SOUNDS_STATE_DIR: stateDir,
      PATH: `${binDir}:/usr/bin:/bin`,
    })

    expect(result.exitCode).toBe(0)
    const log = await getLog(logFile)
    expect(log).toHaveLength(0)
  })
})
