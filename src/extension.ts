import * as vscode from 'vscode';
import { AutoPuller } from './autoPuller';
import { StatusBar } from './statusBar';
import { isValidBranchName } from './gitUtils';

let autoPuller: AutoPuller | undefined;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Auto Pull');
    const statusBar = new StatusBar();
    autoPuller = new AutoPuller(statusBar, outputChannel);

    context.subscriptions.push(
        vscode.commands.registerCommand('autoPull.start', () => {
            autoPuller!.start();
            vscode.window.showInformationMessage('Auto Pull: Started.');
        }),

        vscode.commands.registerCommand('autoPull.stop', () => {
            autoPuller!.stop();
            vscode.window.showInformationMessage('Auto Pull: Stopped.');
        }),

        vscode.commands.registerCommand('autoPull.pullNow', () => {
            autoPuller!.pullNow(/* silent */ false);
        }),

        vscode.commands.registerCommand('autoPull.addBranch', async () => {
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

            const config = vscode.workspace.getConfiguration('autoPull');
            const branches: string[] = [...config.get<string[]>('branches', ['master'])];
            if (branches.includes(branch)) {
                vscode.window.showInformationMessage(`Auto Pull: "${branch}" is already in the list.`);
                return;
            }
            branches.push(branch);
            await config.update('branches', branches, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Auto Pull: Added "${branch}".`);
        }),

        vscode.commands.registerCommand('autoPull.removeBranch', async () => {
            const config = vscode.workspace.getConfiguration('autoPull');
            const branches: string[] = [...config.get<string[]>('branches', ['master'])];
            if (branches.length === 0) {
                vscode.window.showInformationMessage('Auto Pull: No branches configured.');
                return;
            }

            const selected = await vscode.window.showQuickPick(branches, {
                placeHolder: 'Select a branch to remove',
            });
            if (!selected) { return; }

            const updated = branches.filter(b => b !== selected);
            await config.update('branches', updated, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Auto Pull: Removed "${selected}".`);
        }),

        { dispose: () => autoPuller?.dispose() },
        outputChannel,
    );

    // Auto-start if enabled
    const config = vscode.workspace.getConfiguration('autoPull');
    if (config.get<boolean>('enabled', true)) {
        autoPuller.start();
    } else {
        statusBar.setStopped();
    }
}

export function deactivate(): void {
    autoPuller?.dispose();
}
