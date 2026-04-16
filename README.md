# Git Keep Fresh

Ever checked out master only to realize it's 47 commits behind? Yeah, us too.

Git Keep Fresh quietly pulls your branches in the background so they stay up to date without you lifting a finger. It's especially handy for branches you don't actively work on (like master or main) but want to keep current.

## Features

- **Background sync** - fetches and fast-forwards configured branches every N minutes
- **Non-disruptive** - updates branches *without* checking them out (no surprise file changes while you're coding)
- **Safe** - only does fast-forwards. If branches have diverged, it backs off and lets you know
- **Current branch support** - can optionally pull the active branch too (ff-only, and only if your tree is clean)
- **Status bar** - shows sync status and when it last pulled
- **Output panel** - detailed logs in the "Git Keep Fresh" output channel

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
| `Git Keep Fresh: Start` | Start the background sync |
| `Git Keep Fresh: Stop` | Stop syncing |
| `Git Keep Fresh: Pull Now` | Pull all branches right now |
| `Git Keep Fresh: Add Branch` | Add a branch to the watch list |
| `Git Keep Fresh: Remove Branch` | Remove a branch from the watch list |

## How It Works

1. Every interval, the extension runs `git fetch origin --prune`
2. For each configured branch:
   - If the branch **is not checked out**: updates the local ref via fast-forward (no checkout needed)
   - If the branch **is checked out** and `pullCurrentBranch` is enabled: runs `git pull --ff-only` (only when the working tree is clean)
   - If branches have **diverged**: skips and gives you a heads-up
3. Scheduled pulls are **silent on success**. You'll only hear from it if something goes wrong
4. Manual "Pull Now" shows you a summary of what happened

## Safety

- Never force-pushes or rewrites history
- Skips pulls during merge, rebase, or cherry-pick operations
- Validates branch names to prevent command injection
- Sets `GIT_TERMINAL_PROMPT=0` so it won't hang waiting for auth
- Operations are serialized so git commands don't trip over each other
