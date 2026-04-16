# Git Keep Fresh — VS Code Extension

Keeps your local branches fresh by auto-pulling from origin at regular intervals — especially branches you don't work on directly.

## Features

- **Background sync** — fetches and fast-forwards configured branches every N minutes
- **Non-disruptive** — updates branches *without* checking them out (using ref updates for non-active branches)
- **Safe** — only fast-forwards; skips diverged branches and warns you
- **Current branch support** — optionally pulls the active branch with `--ff-only` (only when working tree is clean)
- **Status bar** — shows sync status and last pull time
- **Output panel** — detailed logs in the "Git Keep Fresh" output channel

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitKeepFresh.enabled` | `true` | Auto-start when a Git workspace is opened |
| `gitKeepFresh.branches` | `["master"]` | Branch names to keep fresh |
| `gitKeepFresh.intervalMinutes` | `5` | Minutes between pull cycles (minimum: 1) |
| `gitKeepFresh.pullCurrentBranch` | `false` | Also pull the currently checked-out branch (ff-only, clean tree only) |

## Commands

| Command | Description |
|---|---|
| `Git Keep Fresh: Start` | Start the auto-pull timer |
| `Git Keep Fresh: Stop` | Stop pulling |
| `Git Keep Fresh: Pull Now` | Trigger an immediate pull cycle |
| `Git Keep Fresh: Add Branch` | Add a branch to the watch list |
| `Git Keep Fresh: Remove Branch` | Remove a branch from the watch list |

## How It Works

1. Every interval, the extension runs `git fetch origin --prune`
2. For each configured branch:
   - If the branch **is not checked out**: updates the local ref via fast-forward (no checkout needed)
   - If the branch **is checked out** and `pullCurrentBranch` is enabled: runs `git pull --ff-only` (only if the working tree is clean)
   - If branches have **diverged**: skips and warns
3. Scheduled pulls are **silent on success** — only failures trigger notifications
4. Manual "Pull Now" shows a summary of results

## Safety

- Never force-pushes or modifies history
- Skips pulls during merge/rebase/cherry-pick operations
- Validates branch names to prevent command injection
- Sets `GIT_TERMINAL_PROMPT=0` to avoid hanging on auth prompts
- Operations are serialized to prevent overlapping git commands
