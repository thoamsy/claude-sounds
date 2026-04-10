#!/usr/bin/env bun

import * as p from "@clack/prompts"
import pc from "picocolors"
import { readdir, readlink, symlink, unlink, copyFile, stat, mkdir, readFile, writeFile } from "fs/promises"
import { join, basename, extname, resolve } from "path"
import { homedir } from "os"
import { $ } from "bun"
import { HOOK_NAMES, HOOK_LABELS, THEMES_DIR_NAME, SOUNDS_LINK_NAME } from "./src/constants"
import { injectSoundHooks, removeSoundHooks } from "./src/hooks-config"
import type { HookName } from "./src/constants"

const THEMES_DIR = join(homedir(), ".claude", THEMES_DIR_NAME)
const SOUNDS_LINK = join(homedir(), ".claude", SOUNDS_LINK_NAME)
const SETTINGS_PATH = join(homedir(), ".claude", "settings.json")

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
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

async function getThemeSounds(theme: string): Promise<Map<string, string>> {
  const dir = join(THEMES_DIR, theme)
  const entries = await readdir(dir)
  const map = new Map<string, string>()
  for (const entry of entries) {
    const name = basename(entry, extname(entry))
    map.set(name, entry)
  }
  return map
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

async function cmdUse() {
  const themes = await getThemes()
  const current = await getCurrentTheme()

  if (themes.length === 0) {
    p.log.error("No themes found in " + THEMES_DIR)
    return
  }

  const theme = await p.select({
    message: "Switch to which theme?",
    options: themes.map((t) => ({
      value: t,
      label: t === current ? `${t} ${pc.dim("(current)")}` : t,
    })),
  })

  if (p.isCancel(theme)) return

  await switchTheme(theme)
  p.log.success(`Switched to ${pc.bold(theme)}`)
}

async function cmdEdit() {
  const current = await getCurrentTheme()
  if (!current) {
    p.log.error("No active theme. Run `claude-sounds use` first.")
    return
  }

  const sounds = await getThemeSounds(current)

  p.log.info(`Editing theme: ${pc.bold(current)}`)

  let continueEditing = true
  while (continueEditing) {
    const hookNames = await p.multiselect({
      message: "Select hooks to replace (space to select)",
      options: HOOK_NAMES.map((name) => ({
        value: name,
        label: HOOK_LABELS[name],
        hint: sounds.get(name) ?? pc.dim("(missing)"),
      })),
      required: true,
    })

    if (p.isCancel(hookNames)) return

    const filePath = await p.text({
      message: "Sound file path (drag file here)",
      validate: (v) => {
        const cleaned = v.trim().replace(/\\ /g, " ").replace(/^['"]|['"]$/g, "")
        if (!cleaned) return "Path is required"
      },
    })

    if (p.isCancel(filePath)) return

    const cleaned = (filePath as string)
      .trim()
      .replace(/\\ /g, " ")
      .replace(/^['"]|['"]$/g, "")
    const resolvedPath = resolve(cleaned)

    try {
      await stat(resolvedPath)
    } catch {
      p.log.error(`File not found: ${resolvedPath}`)
      continue
    }

    const shouldPreview = await p.confirm({ message: "Preview?" })
    if (!p.isCancel(shouldPreview) && shouldPreview) {
      await preview(resolvedPath)
      const keep = await p.confirm({ message: "Use this sound?" })
      if (p.isCancel(keep) || !keep) continue
    }

    const ext = extname(resolvedPath)
    const themeDir = join(THEMES_DIR, current)
    for (const hookName of hookNames as HookName[]) {
      const oldFile = sounds.get(hookName)
      if (oldFile && extname(oldFile) !== ext) {
        try {
          await unlink(join(themeDir, oldFile))
        } catch {}
      }
      const newFileName = `${hookName}${ext}`
      await copyFile(resolvedPath, join(themeDir, newFileName))
      sounds.set(hookName, newFileName)
      p.log.success(`${HOOK_LABELS[hookName]} -> ${pc.dim(newFileName)}`)
    }

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
      const file = sounds.get(hookName)
      const label = `  ${HOOK_LABELS[hookName]}`
      if (file) {
        p.log.message(`${pc.dim(label)}: ${file}`)
      } else {
        p.log.message(`${pc.dim(label)}: ${pc.yellow("(missing)")}`)
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

  const result = Bun.spawnSync(["zip", "-j", outPath, ...((await readdir(themeDir)).map((f) => join(themeDir, f)))], {
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
      validate: (v) => {
        if (!v.trim()) return "Path is required"
      },
    })
    if (p.isCancel(result)) return
    inputPath = result as string
  }

  const cleaned = inputPath.trim().replace(/\\ /g, " ").replace(/^['"]|['"]$/g, "")
  const resolved = resolve(cleaned)

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
  }
}

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

async function cmdUninit() {
  const settings = await readSettings()
  const updated = removeSoundHooks(settings)
  await writeSettings(updated)
  p.log.success("Sound hooks removed from settings.json")
}

async function cmdPreview() {
  const current = await getCurrentTheme()
  if (!current) {
    p.log.error("No active theme.")
    return
  }

  const sounds = await getThemeSounds(current)
  const themeDir = join(THEMES_DIR, current)

  const hookName = await p.select({
    message: "Preview which sound?",
    options: HOOK_NAMES.filter((name) => sounds.has(name)).map((name) => ({
      value: name,
      label: HOOK_LABELS[name],
      hint: sounds.get(name),
    })),
  })

  if (p.isCancel(hookName)) return

  const file = sounds.get(hookName)!
  await preview(join(themeDir, file))
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
  if (command === "current") {
    const current = await getCurrentTheme()
    console.log(current ?? "No active theme")
    return
  }

  // interactive mode
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
