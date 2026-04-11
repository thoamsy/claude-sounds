#!/usr/bin/env bun

import * as p from "@clack/prompts"
import pc from "picocolors"
import { copyFile, mkdir, readFile, readdir, readlink, rm, stat, symlink, unlink, writeFile } from "fs/promises"
import { homedir } from "os"
import { basename, extname, join, resolve } from "path"
import { HOOK_LABELS, HOOK_NAMES, SOUNDS_LINK_NAME, THEMES_DIR_NAME } from "./src/constants"
import type { HookName } from "./src/constants"
import { hasSoundHooks, injectSoundHooks, removeSoundHooks } from "./src/hooks-config"
import { PLAY_SOUND_SCRIPT } from "./src/play-script"

const THEMES_DIR = join(homedir(), ".claude", THEMES_DIR_NAME)
const SOUNDS_LINK = join(homedir(), ".claude", SOUNDS_LINK_NAME)
const GLOBAL_SETTINGS_PATH = join(homedir(), ".claude", "settings.json")
const PROJECT_SETTINGS_PATH = join(process.cwd(), ".claude", "settings.json")
const PLAY_SCRIPT_PATH = join(homedir(), ".claude", "play-sound.sh")
const VERSION = require("./package.json").version as string

type SoundInfo =
  | { type: "file"; filename: string }
  | { type: "directory"; variants: string[] }

function cleanPath(raw: string): string {
  return raw.trim().replace(/\\ /g, " ").replace(/^['"]|['"]$/g, "")
}

function soundInfoHint(name: string, info: SoundInfo | undefined): string {
  if (!info) return pc.dim("(missing)")
  return info.type === "file"
    ? info.filename
    : `${name}/ (${info.variants.length} variants)`
}

async function getCurrentTheme(): Promise<string | null> {
  try {
    const target = await readlink(SOUNDS_LINK)
    return basename(target)
  } catch {
    return null
  }
}

async function getThemes(): Promise<string[]> {
  try {
    const entries = await readdir(THEMES_DIR, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

async function getThemeSounds(theme: string): Promise<Map<string, SoundInfo>> {
  const dir = join(THEMES_DIR, theme)
  const entries = await readdir(dir, { withFileTypes: true })
  const sounds = new Map<string, SoundInfo>()

  const dirEntries = entries.filter((entry) => entry.isDirectory())
  const variantResults = await Promise.all(
    dirEntries.map(async (entry) => {
      const variants = (await readdir(join(dir, entry.name), { withFileTypes: true }))
        .filter((file) => file.isFile())
        .map((file) => file.name)
        .sort()
      return { name: entry.name, variants }
    })
  )

  for (const { name, variants } of variantResults) {
    if (variants.length > 0) {
      sounds.set(name, { type: "directory", variants })
    }
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const name = basename(entry.name, extname(entry.name))
    if (!sounds.has(name)) {
      sounds.set(name, { type: "file", filename: entry.name })
    }
  }

  return sounds
}

async function switchTheme(theme: string) {
  try {
    await unlink(SOUNDS_LINK)
  } catch {
    // link doesn't exist yet
  }
  await symlink(join(THEMES_DIR, theme), SOUNDS_LINK)
}

async function preview(filePath: string) {
  Bun.spawnSync(["killall", "afplay"], { stderr: "ignore" })
  Bun.spawn(["afplay", filePath])
}

async function ensurePlayScript(): Promise<boolean> {
  const existing = await Bun.file(PLAY_SCRIPT_PATH).text().catch(() => null)
  if (existing === PLAY_SOUND_SCRIPT) return false
  await writeFile(PLAY_SCRIPT_PATH, PLAY_SOUND_SCRIPT, { mode: 0o755 })
  return true
}

async function cmdUse() {
  const themes = await getThemes()
  const current = await getCurrentTheme()

  if (themes.length === 0) {
    p.log.error("No themes found in " + THEMES_DIR)
    return
  }

  const theme = await p.select({
    message: "Switch to which theme?",
    options: themes.map((entry) => ({
      value: entry,
      label: entry === current ? `${entry} ${pc.dim("(current)")}` : entry,
    })),
  })

  if (p.isCancel(theme)) return

  await switchTheme(theme)
  p.log.success(`Switched to ${pc.bold(theme)}`)

  if (await ensurePlayScript()) p.log.info("play-sound.sh updated")
  const settings = await readSettings(GLOBAL_SETTINGS_PATH)
  if (!hasSoundHooks(settings)) {
    const updated = injectSoundHooks(settings)
    await writeSettings(GLOBAL_SETTINGS_PATH, updated)
    p.log.success("Sound hooks injected into settings.json")
  }
}

type PromptPathResult =
  | { type: "file"; path: string }
  | { type: "directory"; path: string; files: string[] }

async function promptPath(): Promise<PromptPathResult | null> {
  const input = await p.text({
    message: "Sound file or folder path (drag here)",
    validate: (value) => {
      if (!cleanPath(value ?? "")) return "Path is required"
    },
  })

  if (p.isCancel(input)) return null

  const resolvedPath = resolve(cleanPath(input as string))

  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(resolvedPath)
  } catch {
    p.log.error(`Not found: ${resolvedPath}`)
    return null
  }

  if (info.isDirectory()) {
    const files = (await readdir(resolvedPath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort()

    if (files.length === 0) {
      p.log.error("Folder is empty")
      return null
    }

    p.log.info(`Found ${files.length} files: ${pc.dim(files.join(", "))}`)
    return { type: "directory", path: resolvedPath, files }
  }

  const shouldPreview = await p.confirm({ message: "Preview?" })
  if (!p.isCancel(shouldPreview) && shouldPreview) {
    await preview(resolvedPath)
    const keep = await p.confirm({ message: "Use this sound?" })
    if (p.isCancel(keep) || !keep) return null
  }

  return { type: "file", path: resolvedPath }
}

async function cmdEdit() {
  const current = await getCurrentTheme()
  if (!current) {
    p.log.error("No active theme. Run `claude-sounds use` first.")
    return
  }

  const themeDir = join(THEMES_DIR, current)
  let sounds = await getThemeSounds(current)

  p.log.info(`Editing theme: ${pc.bold(current)}`)

  let continueEditing = true
  while (continueEditing) {
    const hookChoice = await p.select({
      message: "Select hook to edit",
      options: HOOK_NAMES.map((name) => ({
        value: name,
        label: HOOK_LABELS[name],
        hint: soundInfoHint(name, sounds.get(name)),
      })),
    })

    if (p.isCancel(hookChoice)) return

    const hookName = hookChoice as HookName
    const info = sounds.get(hookName)

    if (info?.type === "directory") {
      const actionChoice = await p.select({
        message: `${hookName}/ has ${info.variants.length} variants:`,
        options: [
          { value: "add", label: "Add variant" },
          { value: "remove", label: "Remove variant" },
          { value: "replace", label: "Replace all", hint: "remove folder, set single file" },
        ],
      })

      if (p.isCancel(actionChoice)) return

      const action = actionChoice as "add" | "remove" | "replace"
      if (action === "add") {
        const result = await promptPath()
        if (!result) continue

        const destDir = join(themeDir, hookName)
        if (result.type === "directory") {
          await Promise.all(
            result.files.map((file) => copyFile(join(result.path, file), join(destDir, file)))
          )
          p.log.success(`Added ${result.files.length} variants to ${pc.dim(`${hookName}/`)}`)
        } else {
          const ext = extname(result.path)
          const name = basename(result.path, ext)
          await copyFile(result.path, join(destDir, `${name}${ext}`))
          p.log.success(`Added variant ${pc.dim(`${hookName}/${name}${ext}`)}`)
        }
      } else if (action === "remove") {
        const variantChoice = await p.select({
          message: "Remove which variant?",
          options: info.variants.map((variant) => ({ value: variant, label: variant })),
        })

        if (p.isCancel(variantChoice)) continue

        const variant = variantChoice as string
        await unlink(join(themeDir, hookName, variant))
        p.log.success(`Removed ${pc.dim(`${hookName}/${variant}`)}`)
      } else {
        const result = await promptPath()
        if (!result) continue

        await rm(join(themeDir, hookName), { recursive: true, force: true })

        if (result.type === "directory") {
          const destDir = join(themeDir, hookName)
          await mkdir(destDir, { recursive: true })
          await Promise.all(
            result.files.map((file) => copyFile(join(result.path, file), join(destDir, file)))
          )
          p.log.success(`Replaced with ${result.files.length} variants in ${pc.dim(`${hookName}/`)}`)
        } else {
          const ext = extname(result.path)
          await copyFile(result.path, join(themeDir, `${hookName}${ext}`))
          p.log.success(`Replaced with single file ${pc.dim(`${hookName}${ext}`)}`)
        }
      }
    } else {
      const actionChoice = await p.select({
        message: info ? `${hookName} is a single file (${info.filename})` : `${hookName} is missing`,
        options: [
          { value: "replace", label: "Replace file" },
          { value: "add-variant", label: "Add variant", hint: "convert to folder with multiple sounds" },
        ],
      })

      if (p.isCancel(actionChoice)) return

      const result = await promptPath()
      if (!result) continue

      const action = actionChoice as "replace" | "add-variant"
      if (action === "replace") {
        if (result.type === "directory") {
          if (info) {
            try { await unlink(join(themeDir, info.filename)) } catch {}
          }
          const destDir = join(themeDir, hookName)
          await mkdir(destDir, { recursive: true })
          await Promise.all(
            result.files.map((file) => copyFile(join(result.path, file), join(destDir, file)))
          )
          p.log.success(`Replaced with ${result.files.length} variants in ${pc.dim(`${hookName}/`)}`)
        } else {
          const ext = extname(result.path)
          if (info && extname(info.filename) !== ext) {
            try { await unlink(join(themeDir, info.filename)) } catch {}
          }
          const newFileName = `${hookName}${ext}`
          await copyFile(result.path, join(themeDir, newFileName))
          p.log.success(`${HOOK_LABELS[hookName]} -> ${pc.dim(newFileName)}`)
        }
      } else {
        const eventDir = join(themeDir, hookName)
        await mkdir(eventDir, { recursive: true })

        if (info) {
          await copyFile(join(themeDir, info.filename), join(eventDir, info.filename))
          await unlink(join(themeDir, info.filename))
        }

        if (result.type === "directory") {
          await Promise.all(
            result.files.map((file) => copyFile(join(result.path, file), join(eventDir, file)))
          )
          p.log.success(`Converted to folder with ${result.files.length} variants`)
        } else {
          const ext = extname(result.path)
          const name = basename(result.path, ext)
          await copyFile(result.path, join(eventDir, `${name}${ext}`))
          p.log.success("Converted to folder with variants")
        }
      }
    }

    sounds = await getThemeSounds(current)

    const next = await p.confirm({ message: "Edit more?" })
    continueEditing = !p.isCancel(next) && next
  }
}

async function cmdList() {
  const themes = await getThemes()
  const current = await getCurrentTheme()

  for (const theme of themes) {
    const isCurrent = theme === current
    const prefix = isCurrent ? pc.green("● ") : pc.dim("○ ")
    p.log.message(`${prefix}${pc.bold(theme)}`)

    const sounds = await getThemeSounds(theme)
    for (const hookName of HOOK_NAMES) {
      const info = sounds.get(hookName)
      const label = `  ${HOOK_LABELS[hookName]}`
      if (!info) {
        p.log.message(`${pc.dim(label)}: ${pc.yellow("(missing)")}`)
      } else if (info.type === "file") {
        p.log.message(`${pc.dim(label)}: ${info.filename}`)
      } else {
        p.log.message(
          `${pc.dim(label)}: ${pc.cyan(`${hookName}/`)} ${pc.dim(`(${info.variants.length} variants: ${info.variants.join(", ")})`)}`
        )
      }
    }
  }
}

async function cmdExport(themeName?: string) {
  const name = themeName ?? (await getCurrentTheme())
  if (!name) {
    p.log.error("No active theme. Specify a theme name or activate one first.")
    return
  }

  const themes = await getThemes()
  if (!themes.includes(name)) {
    p.log.error(`Theme "${name}" not found.`)
    return
  }

  const themeDir = join(THEMES_DIR, name)
  const outPath = join(homedir(), "Downloads", `${name}.zip`)

  const result = Bun.spawnSync(["zip", "-r", outPath, "."], {
    cwd: themeDir,
    stderr: "pipe",
  })

  if (result.exitCode !== 0) {
    p.log.error(`Export failed: ${result.stderr.toString()}`)
    return
  }

  p.log.success(`Exported to ${pc.dim(outPath)}`)
}

async function cmdImport(zipPath?: string) {
  let inputPath = zipPath
  if (!inputPath) {
    const result = await p.text({
      message: "Zip file path (drag file here)",
      validate: (value) => {
        if (!(value ?? "").trim()) return "Path is required"
      },
    })
    if (p.isCancel(result)) return
    inputPath = result as string
  }

  const resolved = resolve(cleanPath(inputPath))

  try {
    await stat(resolved)
  } catch {
    p.log.error(`File not found: ${resolved}`)
    return
  }

  let themeName = basename(resolved, ".zip")
  const themes = await getThemes()

  if (themes.includes(themeName)) {
    const action = await p.select({
      message: `Theme "${themeName}" already exists`,
      options: [
        { value: "overwrite", label: "Overwrite" },
        { value: "rename", label: `Rename to "${themeName}-2"` },
        { value: "cancel", label: "Cancel" },
      ],
    })

    if (p.isCancel(action) || action === "cancel") return

    if (action === "rename") {
      themeName = `${themeName}-2`
    }
  }

  const themeDir = join(THEMES_DIR, themeName)
  await mkdir(themeDir, { recursive: true })

  const result = Bun.spawnSync(["unzip", "-o", resolved, "-d", themeDir], {
    stderr: "pipe",
  })

  if (result.exitCode !== 0) {
    p.log.error(`Import failed: ${result.stderr.toString()}`)
    return
  }

  const sounds = await readdir(themeDir)
  p.log.success(`Imported ${pc.bold(themeName)} (${sounds.length} sounds)`)

  const switchNow = await p.confirm({ message: `Switch to "${themeName}" now?` })
  if (!p.isCancel(switchNow) && switchNow) {
    await switchTheme(themeName)
    p.log.success(`Switched to ${pc.bold(themeName)}`)

    if (await ensurePlayScript()) p.log.info("play-sound.sh updated")
    const settings = await readSettings(GLOBAL_SETTINGS_PATH)
    if (!hasSoundHooks(settings)) {
      const updated = injectSoundHooks(settings)
      await writeSettings(GLOBAL_SETTINGS_PATH, updated)
      p.log.success("Sound hooks injected into settings.json")
    }
  }
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(path, "utf-8")
    return JSON.parse(text)
  } catch {
    return {}
  }
}

async function writeSettings(path: string, settings: Record<string, unknown>) {
  await mkdir(join(path, ".."), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n")
}

async function pickSettingsScope(): Promise<string | null> {
  const scope = await p.select({
    message: "Where to install hooks?",
    options: [
      { value: "global", label: "Global", hint: "~/.claude/settings.json — all projects" },
      { value: "project", label: "This project", hint: ".claude/settings.json — current repo only" },
    ],
  })
  if (p.isCancel(scope)) return null
  return scope === "global" ? GLOBAL_SETTINGS_PATH : PROJECT_SETTINGS_PATH
}

async function cmdInit() {
  const settingsPath = await pickSettingsScope()
  if (!settingsPath) return

  if (await ensurePlayScript()) p.log.info("play-sound.sh updated")
  const settings = await readSettings(settingsPath)
  const updated = injectSoundHooks(settings)
  await writeSettings(settingsPath, updated)
  p.log.success(`Sound hooks injected into ${pc.dim(settingsPath)}`)
}

async function cmdUninit() {
  const settingsPath = await pickSettingsScope()
  if (!settingsPath) return

  const settings = await readSettings(settingsPath)
  const updated = removeSoundHooks(settings)
  await writeSettings(settingsPath, updated)
  p.log.success(`Sound hooks removed from ${pc.dim(settingsPath)}`)
}

async function cmdPreview() {
  const current = await getCurrentTheme()
  if (!current) {
    p.log.error("No active theme.")
    return
  }

  const sounds = await getThemeSounds(current)
  const themeDir = join(THEMES_DIR, current)

  const hookChoice = await p.select({
    message: "Preview which sound?",
    options: HOOK_NAMES.filter((name) => sounds.has(name)).map((name) => ({
      value: name,
      label: HOOK_LABELS[name],
      hint: soundInfoHint(name, sounds.get(name)),
    })),
  })

  if (p.isCancel(hookChoice)) return

  const hookName = hookChoice as HookName
  const info = sounds.get(hookName)!

  if (info.type === "file") {
    await preview(join(themeDir, info.filename))
    p.log.info(`Playing ${info.filename}...`)
    return
  }

  const variantChoice = await p.select({
    message: `${info.variants.length} variants available:`,
    options: [
      { value: "__random__", label: "Random", hint: "pick one at random" },
      ...info.variants.map((variant) => ({ value: variant, label: variant })),
    ],
  })

  if (p.isCancel(variantChoice)) return

  const file =
    variantChoice === "__random__"
      ? info.variants[Math.floor(Math.random() * info.variants.length)]!
      : (variantChoice as string)

  await preview(join(themeDir, hookName, file))
  p.log.info(`Playing ${file}...`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === "use") return cmdUse()
  if (command === "edit") return cmdEdit()
  if (command === "list") return cmdList()
  if (command === "preview") return cmdPreview()
  if (command === "export") return cmdExport(args[1])
  if (command === "import") return cmdImport(args[1])
  if (command === "init") return cmdInit()
  if (command === "uninit") return cmdUninit()
  if (command === "version") {
    console.log(VERSION)
    return
  }
  if (command === "current") {
    const current = await getCurrentTheme()
    console.log(current ?? "No active theme")
    return
  }

  p.intro(pc.bgCyan(pc.black(" claude-sounds ")))

  const current = await getCurrentTheme()
  if (current) {
    p.log.info(`Current theme: ${pc.bold(current)}`)
  }

  const action = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "use", label: "Switch theme" },
      { value: "edit", label: "Edit current theme", hint: "replace individual sounds" },
      { value: "preview", label: "Preview sounds" },
      { value: "list", label: "List all themes" },
      { value: "export", label: "Export theme", hint: "zip to ~/Downloads" },
      { value: "import", label: "Import theme", hint: "from zip file" },
      { value: "init", label: "Setup hooks", hint: "inject sound hooks into settings.json" },
      { value: "uninit", label: "Remove hooks", hint: "remove sound hooks from settings.json" },
    ],
  })

  if (p.isCancel(action)) {
    p.outro("Bye!")
    return
  }

  switch (action) {
    case "use":
      await cmdUse()
      break
    case "edit":
      await cmdEdit()
      break
    case "preview":
      await cmdPreview()
      break
    case "list":
      await cmdList()
      break
    case "export":
      await cmdExport()
      break
    case "import":
      await cmdImport()
      break
    case "init":
      await cmdInit()
      break
    case "uninit":
      await cmdUninit()
      break
  }

  p.outro(pc.dim("Done!"))
}

main().catch(console.error)
