# Auto Pull — VS Code Extension

Automatically keeps your local branches up to date by pulling from `origin` at regular intervals.

## Features

- **Auto-pull on interval** — fetches and fast-forwards configured branches every N minutes
- **Non-disruptive** — updates branches *without* checking them out (using ref updates for non-active branches)
- **Safe** — only fast-forwards; skips diverged branches and warns you
- **Current branch support** — optionally pulls the active branch with `--ff-only` (only when working tree is clean)
- **Status bar** — shows auto-pull status and last pull time
- **Output panel** — detailed logs in the "Auto Pull" output channel

## Settings

| Setting | Default | Description |
|---|---|---|
| `autoPull.enabled` | `true` | Auto-start when a Git workspace is opened |
| `autoPull.branches` | `["master"]` | Branch names to keep up to date |
| `autoPull.intervalMinutes` | `5` | Minutes between pull cycles (minimum: 1) |
| `autoPull.pullCurrentBranch` | `false` | Also pull the currently checked-out branch (ff-only, clean tree only) |

## Commands

| Command | Description |
|---|---|
| `Auto Pull: Start` | Start the auto-pull timer |
| `Auto Pull: Stop` | Stop auto-pulling |
| `Auto Pull: Pull Now` | Trigger an immediate pull cycle |
| `Auto Pull: Add Branch` | Add a branch to the watch list |
| `Auto Pull: Remove Branch` | Remove a branch from the watch list |

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
