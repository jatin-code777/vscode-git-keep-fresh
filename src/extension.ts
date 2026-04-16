import * as vscode from 'vscode';
import { AutoPuller } from './autoPuller';
import { StatusBar } from './statusBar';
import { isValidBranchName } from './gitUtils';
import { DEFAULT_BRANCHES } from './constants';

let autoPuller: AutoPuller | undefined;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Git Keep Fresh');
    const statusBar = new StatusBar();
    autoPuller = new AutoPuller(statusBar, outputChannel);

    context.subscriptions.push(
        vscode.commands.registerCommand('gitKeepFresh.start', () => {
            autoPuller!.start();
            vscode.window.showInformationMessage('Git Keep Fresh: Started! Your branches will stay fresh.');
        }),

        vscode.commands.registerCommand('gitKeepFresh.stop', () => {
            autoPuller!.stop();
            vscode.window.showInformationMessage('Git Keep Fresh: Stopped. Branches are on their own now.');
        }),

        vscode.commands.registerCommand('gitKeepFresh.pullNow', () => {
            autoPuller!.pullNow(/* silent */ false);
        }),

        vscode.commands.registerCommand('gitKeepFresh.addBranch', async () => {
            const branch = await vscode.window.showInputBox({
                prompt: 'Enter branch name to add',
                placeHolder: 'e.g. main, develop',
                validateInput: (value) => {
                    if (!isValidBranchName(value)) {
                        return 'Invalid branch name. Use letters, numbers, dots, hyphens, underscores, and slashes.';
                    }
                    return null;
                },
            });
            if (!branch) { return; }

            const config = vscode.workspace.getConfiguration('gitKeepFresh');
            const branches: string[] = [...config.get<string[]>('branches', DEFAULT_BRANCHES)];
            if (branches.includes(branch)) {
                vscode.window.showInformationMessage(`Git Keep Fresh: "${branch}" is already on the list!`);
                return;
            }
            branches.push(branch);
            await config.update('branches', branches, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Git Keep Fresh: Now watching "${branch}".`);
        }),

        vscode.commands.registerCommand('gitKeepFresh.removeBranch', async () => {
            const config = vscode.workspace.getConfiguration('gitKeepFresh');
            const branches: string[] = [...config.get<string[]>('branches', DEFAULT_BRANCHES)];
            if (branches.length === 0) {
                vscode.window.showInformationMessage('Git Keep Fresh: No branches configured yet.');
                return;
            }

            const selected = await vscode.window.showQuickPick(branches, {
                placeHolder: 'Select a branch to remove',
            });
            if (!selected) { return; }

            const updated = branches.filter(b => b !== selected);
            await config.update('branches', updated, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Git Keep Fresh: Stopped watching "${selected}".`);
        }),

        { dispose: () => autoPuller?.dispose() },
        outputChannel,
    );

    // Auto-start if enabled
    const config = vscode.workspace.getConfiguration('gitKeepFresh');
    if (config.get<boolean>('enabled', true)) {
        autoPuller.start();
    } else {
        statusBar.setStopped();
    }
}

export function deactivate(): void {
    autoPuller?.dispose();
}
