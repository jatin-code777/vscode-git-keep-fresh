import * as vscode from 'vscode';
import {
    fetchOrigin,
    getBranchStatus,
    fastForwardBranch,
    pullCurrentBranch,
    getCurrentBranch,
    isWorkingTreeClean,
    isGitOperationInProgress,
    getRepoRoot,
} from './gitUtils';
import { StatusBar } from './statusBar';

export interface PullResult {
    branch: string;
    status: 'updated' | 'up-to-date' | 'skipped' | 'error';
    detail: string;
}

export class AutoPuller {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private isRunning = false;
    private isPulling = false;
    private statusBar: StatusBar;
    private lastPull: Date | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(statusBar: StatusBar, outputChannel: vscode.OutputChannel) {
        this.statusBar = statusBar;
        this.outputChannel = outputChannel;
    }

    get active(): boolean {
        return this.isRunning;
    }

    start(): void {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.statusBar.setRunning(this.lastPull ?? undefined);
        this.scheduleNext();
        this.log('Auto Pull started');
    }

    stop(): void {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.statusBar.setStopped();
        this.log('Auto Pull stopped');
    }

    async pullNow(silent: boolean = false): Promise<PullResult[]> {
        if (this.isPulling) {
            if (!silent) {
                vscode.window.showWarningMessage('Auto Pull: A pull operation is already in progress.');
            }
            return [];
        }

        const cwd = this.getWorkspaceRoot();
        if (!cwd) {
            const msg = 'Auto Pull: No workspace folder open.';
            if (!silent) { vscode.window.showWarningMessage(msg); }
            this.log(msg);
            return [];
        }

        const repoRoot = await getRepoRoot(cwd);
        if (!repoRoot) {
            const msg = 'Auto Pull: Current workspace is not a Git repository.';
            if (!silent) { vscode.window.showWarningMessage(msg); }
            this.log(msg);
            return [];
        }

        const config = vscode.workspace.getConfiguration('autoPull');
        const branches: string[] = config.get('branches', ['master']);
        const pullCurrent: boolean = config.get('pullCurrentBranch', false);

        this.isPulling = true;
        this.statusBar.setPulling();
        const results: PullResult[] = [];

        try {
            // Check if a git operation is in progress
            if (await isGitOperationInProgress(repoRoot)) {
                const msg = 'Auto Pull: Git operation in progress (merge/rebase/cherry-pick). Skipping.';
                this.log(msg);
                if (!silent) { vscode.window.showWarningMessage(msg); }
                return [];
            }

            this.log('Fetching from origin...');
            await fetchOrigin(repoRoot);
            this.log('Fetch complete.');

            const currentBranch = await getCurrentBranch(repoRoot);

            for (const branch of branches) {
                const result = await this.updateBranch(repoRoot, branch, currentBranch, pullCurrent);
                results.push(result);
            }

            this.lastPull = new Date();
            this.statusBar.setLastPull(this.lastPull);

            // Log results
            for (const r of results) {
                this.log(`  ${r.branch}: ${r.status} — ${r.detail}`);
            }

            // Show summary for manual pulls
            if (!silent) {
                const updated = results.filter(r => r.status === 'updated');
                const errors = results.filter(r => r.status === 'error');
                const skipped = results.filter(r => r.status === 'skipped');

                if (errors.length > 0) {
                    vscode.window.showWarningMessage(
                        `Auto Pull: ${errors.length} error(s). Check Output panel for details.`
                    );
                } else if (updated.length > 0) {
                    vscode.window.showInformationMessage(
                        `Auto Pull: Updated ${updated.map(r => r.branch).join(', ')}.`
                    );
                } else if (skipped.length > 0) {
                    vscode.window.showInformationMessage(
                        `Auto Pull: All branches up to date or skipped.`
                    );
                } else {
                    vscode.window.showInformationMessage('Auto Pull: All branches up to date.');
                }
            } else {
                // For scheduled pulls, only show warnings on errors
                const errors = results.filter(r => r.status === 'error');
                if (errors.length > 0) {
                    vscode.window.showWarningMessage(
                        `Auto Pull: Failed to update ${errors.map(r => r.branch).join(', ')}. Check Output panel.`
                    );
                }
            }
        } catch (err: any) {
            const msg = `Auto Pull: Fetch failed — ${err.message}`;
            this.log(msg);
            if (!silent) {
                vscode.window.showErrorMessage(msg);
            }
        } finally {
            this.isPulling = false;
            if (this.isRunning) {
                this.statusBar.setLastPull(this.lastPull ?? new Date());
            }
        }

        return results;
    }

    private async updateBranch(
        repoRoot: string,
        branch: string,
        currentBranch: string,
        pullCurrent: boolean
    ): Promise<PullResult> {
        try {
            const isCheckedOut = branch === currentBranch;

            if (isCheckedOut && !pullCurrent) {
                return {
                    branch,
                    status: 'skipped',
                    detail: 'Currently checked out (set autoPull.pullCurrentBranch to enable)',
                };
            }

            const branchStatus = await getBranchStatus(repoRoot, branch);

            switch (branchStatus) {
                case 'up-to-date':
                    return { branch, status: 'up-to-date', detail: 'Already up to date' };

                case 'no-remote':
                    return { branch, status: 'skipped', detail: 'No remote tracking branch origin/' + branch };

                case 'no-local':
                    return { branch, status: 'skipped', detail: 'Local branch does not exist' };

                case 'local-ahead':
                    return { branch, status: 'skipped', detail: 'Local branch is ahead of origin' };

                case 'diverged':
                    return { branch, status: 'skipped', detail: 'Branches have diverged (manual merge needed)' };

                case 'fast-forward':
                    if (isCheckedOut) {
                        // Pull the active branch, but only if clean
                        if (!(await isWorkingTreeClean(repoRoot))) {
                            return { branch, status: 'skipped', detail: 'Working tree has uncommitted changes' };
                        }
                        await pullCurrentBranch(repoRoot);
                    } else {
                        await fastForwardBranch(repoRoot, branch);
                    }
                    return { branch, status: 'updated', detail: 'Fast-forwarded to origin/' + branch };

                default:
                    return { branch, status: 'error', detail: 'Unknown branch status' };
            }
        } catch (err: any) {
            return { branch, status: 'error', detail: err.message };
        }
    }

    private scheduleNext(): void {
        if (!this.isRunning) { return; }

        const config = vscode.workspace.getConfiguration('autoPull');
        const intervalMin = Math.max(1, config.get<number>('intervalMinutes', 5));
        const intervalMs = intervalMin * 60 * 1000;

        this.timer = setTimeout(async () => {
            await this.pullNow(/* silent */ true);
            this.scheduleNext();
        }, intervalMs);
    }

    private getWorkspaceRoot(): string | null {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return null; }
        return folders[0].uri.fsPath;
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    dispose(): void {
        this.stop();
        this.statusBar.dispose();
    }
}
