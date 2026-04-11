---
name: release
description: Bump version, commit, tag, and push to trigger a GitHub Actions release.
disable-model-invocation: true
---

Release a new version. Accepts an optional semver bump type via $ARGUMENTS (default: patch).

Steps:

1. Run `/verify` to ensure tests pass and types check
2. Determine bump type from $ARGUMENTS: "major", "minor", or "patch" (default "patch")
3. Run `npm version $BUMP_TYPE --no-git-tag-version` to update package.json
4. Read the new version from package.json
5. Commit: `git add package.json && git commit -m "chore: bump version to $VERSION"`
6. Tag: `git tag v$VERSION`
7. Push: `git push && git push origin v$VERSION`
8. Report: "Released v$VERSION — GitHub Action will create the release and update Homebrew."
