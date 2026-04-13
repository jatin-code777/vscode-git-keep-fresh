import { execFile } from 'child_process';
import * as path from 'path';

export interface GitResult {
    stdout: string;
    stderr: string;
}

const TIMEOUT_MS = 30_000;

function runGit(args: string[], cwd: string): Promise<GitResult> {
    return new Promise((resolve, reject) => {
        execFile('git', args, {
            cwd,
            timeout: TIMEOUT_MS,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`git ${args.join(' ')} failed: ${stderr || error.message}`));
            } else {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            }
        });
    });
}

/** Returns the root of the git repository, or null if not a repo. */
export async function getRepoRoot(cwd: string): Promise<string | null> {
    try {
        const { stdout } = await runGit(['rev-parse', '--show-toplevel'], cwd);
        return stdout;
    } catch {
        return null;
    }
}

/** Returns the name of the currently checked-out branch. */
export async function getCurrentBranch(cwd: string): Promise<string> {
    const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    return stdout;
}

/** Returns true if the working tree is clean (no uncommitted changes). */
export async function isWorkingTreeClean(cwd: string): Promise<boolean> {
    const { stdout } = await runGit(['status', '--porcelain'], cwd);
    return stdout.length === 0;
}

/** Returns true if a git operation (merge, rebase, etc.) is in progress. */
export async function isGitOperationInProgress(cwd: string): Promise<boolean> {
    const repoRoot = await getRepoRoot(cwd);
    if (!repoRoot) { return false; }

    const fs = await import('fs');
    const gitDir = path.join(repoRoot, '.git');
    const markers = ['MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply'];

    for (const marker of markers) {
        try {
            await fs.promises.access(path.join(gitDir, marker));
            return true;
        } catch {
            // marker doesn't exist, continue
        }
    }
    return false;
}

/** Fetches all refs from origin. */
export async function fetchOrigin(cwd: string): Promise<void> {
    await runGit(['fetch', 'origin', '--prune'], cwd);
}

/**
 * Checks if localBranch can be fast-forwarded to origin/<branch>.
 * Returns 'fast-forward' | 'up-to-date' | 'diverged' | 'local-ahead' | 'no-remote'.
 */
export async function getBranchStatus(
    cwd: string,
    branch: string
): Promise<'fast-forward' | 'up-to-date' | 'diverged' | 'local-ahead' | 'no-remote' | 'no-local'> {
    // Check if remote branch exists
    try {
        await runGit(['rev-parse', '--verify', `refs/remotes/origin/${branch}`], cwd);
    } catch {
        return 'no-remote';
    }

    // Check if local branch exists
    try {
        await runGit(['rev-parse', '--verify', `refs/heads/${branch}`], cwd);
    } catch {
        return 'no-local';
    }

    const { stdout: localSha } = await runGit(['rev-parse', `refs/heads/${branch}`], cwd);
    const { stdout: remoteSha } = await runGit(['rev-parse', `refs/remotes/origin/${branch}`], cwd);

    if (localSha === remoteSha) {
        return 'up-to-date';
    }

    // Check if local is ancestor of remote (fast-forward possible)
    try {
        await runGit(['merge-base', '--is-ancestor', localSha, remoteSha], cwd);
        return 'fast-forward';
    } catch {
        // not an ancestor
    }

    // Check if remote is ancestor of local (local is ahead)
    try {
        await runGit(['merge-base', '--is-ancestor', remoteSha, localSha], cwd);
        return 'local-ahead';
    } catch {
        // not an ancestor
    }

    return 'diverged';
}

/** Fast-forwards a local branch ref to match origin/<branch> without checkout. */
export async function fastForwardBranch(cwd: string, branch: string): Promise<void> {
    await runGit(['update-ref', `refs/heads/${branch}`, `refs/remotes/origin/${branch}`], cwd);
}

/** Pulls the currently checked-out branch with --ff-only. */
export async function pullCurrentBranch(cwd: string): Promise<void> {
    await runGit(['pull', '--ff-only', 'origin'], cwd);
}

/** Validates a branch name. Returns true if it looks safe. */
export function isValidBranchName(name: string): boolean {
    if (!name || name.length === 0 || name.length > 250) {
        return false;
    }
    // Reject names starting with - (could be interpreted as options)
    if (name.startsWith('-')) {
        return false;
    }
    // Allow typical branch name characters
    return /^[a-zA-Z0-9._\-/]+$/.test(name);
}
