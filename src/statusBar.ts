import * as vscode from 'vscode';

export class StatusBar {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'gitKeepFresh.pullNow';
    }

    setRunning(lastPull?: Date): void {
        const timeStr = lastPull ? this.formatTime(lastPull) : 'never';
        this.item.text = `$(sync~spin) Keep Fresh: ON`;
        this.item.tooltip = `Git Keep Fresh is active. Last pull: ${timeStr}. Click to pull now.`;
        this.item.show();
    }

    setStopped(): void {
        this.item.text = `$(sync-ignored) Keep Fresh: OFF`;
        this.item.tooltip = 'Git Keep Fresh is stopped. Click to pull now.';
        this.item.show();
    }

    setPulling(): void {
        this.item.text = `$(loading~spin) Keep Fresh: pulling...`;
        this.item.tooltip = 'Pulling branches...';
        this.item.show();
    }

    setLastPull(date: Date): void {
        this.item.text = `$(check) Keep Fresh: ${this.formatTime(date)}`;
        this.item.tooltip = `Git Keep Fresh is active. Last pull: ${this.formatTime(date)}. Click to pull now.`;
        this.item.show();
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    dispose(): void {
        this.item.dispose();
    }
}
