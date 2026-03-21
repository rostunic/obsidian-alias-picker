import { App, TAbstractFile, TFile, Notice } from 'obsidian';
import { AliasCache } from './AliasCache';
import { AliasPicker } from './AliasPicker';
import { getBacklinksArray, normalizeAliases } from './utilities';

export class AliasRenameListener {
    private pendingTimers: Map<string, number> = new Map();
    private initialResolvedHandled = false;

    constructor(private app: App, private aliasCache: AliasCache) {
    }

    private populateCacheFromMetadata = () => {
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file);
            const aliases = normalizeAliases(cache?.frontmatter?.aliases);
            this.aliasCache.setAliases(file.path, aliases);
        }
    };

    private onMetadataResolved = () => {
        if (this.initialResolvedHandled) return;
        this.initialResolvedHandled = true;
        this.populateCacheFromMetadata();
    };

    public startListening() {
        // Populate once immediately (may be partial on cold start) and once after initial resolve.
        this.populateCacheFromMetadata();

        this.app.metadataCache.on('resolved', this.onMetadataResolved);
        this.app.metadataCache.on('changed', this.onMetadataChanged);

        // Some vault events are missing/loosely typed in the Obsidian typings.
        (this.app.vault as unknown as { on: (name: string, cb: (...args: unknown[]) => unknown) => void }).on('rename', this.onFileRenamed as (...data: unknown[]) => unknown);
        (this.app.vault as unknown as { on: (name: string, cb: (...args: unknown[]) => unknown) => void }).on('delete', this.onFileDeleted as (...data: unknown[]) => unknown);
    }
    public stopListening() {
        this.app.metadataCache.off('resolved', this.onMetadataResolved as (...data: unknown[]) => unknown);
        this.app.metadataCache.off('changed', this.onMetadataChanged as (...data: unknown[]) => unknown);
        (this.app.vault as unknown as { off: (name: string, cb: (...args: unknown[]) => unknown) => void }).off('rename', this.onFileRenamed as (...data: unknown[]) => unknown);
        (this.app.vault as unknown as { off: (name: string, cb: (...args: unknown[]) => unknown) => void }).off('delete', this.onFileDeleted as (...data: unknown[]) => unknown);

        for (const timer of this.pendingTimers.values()) {
            window.clearTimeout(timer);
        }
        this.pendingTimers.clear();
    }

    private processFileAliases = async (file: TFile) => {
        const cache = this.app.metadataCache.getFileCache(file);
        const aliases = normalizeAliases(cache?.frontmatter?.aliases);

        const oldAliases = this.aliasCache.getAliases(file.path) ?? [];

        const addedAliases = aliases.filter(x => !oldAliases.includes(x));
        const removedAliases = oldAliases.filter(x => !aliases.includes(x));

        if (addedAliases.length === 1 && removedAliases.length === 1) {
            // Heuristic: treat 1-added + 1-removed as a rename.
            const oldAlias = removedAliases[0];
            const newAlias = addedAliases[0];

            const backlinksArray = getBacklinksArray(this.app, file);
            const backlinks = backlinksArray
                .map(([path, links]) => ({ path, links: links.filter(link => link.displayText === oldAlias) }))
                .filter(x => x.links.length > 0);

            for (const backlink of backlinks) {
                const backlinkFile = this.app.vault.getFileByPath(backlink.path);
                if (!backlinkFile) continue;

                const fileContent = await this.app.vault.cachedRead(backlinkFile);
                const newContent = backlink.links.reduce((content, link) => {
                    const oldText = link.original;
                    const newText = AliasPicker.generateLinkWithAlias(this.app, file, newAlias, link);
                    return content.replace(oldText, newText);
                }, fileContent);

                if (newContent !== fileContent) {
                    await this.app.vault.modify(backlinkFile, newContent);
                    new Notice(`Renamed alias in ${backlinkFile.path}`);
                }
            }

            new Notice(`Renamed alias "${oldAlias}" to "${newAlias}" in ${backlinks.length} files`);
        }

        // Always keep cache in sync (including removals).
        this.aliasCache.setAliases(file.path, aliases);
    };

    private onMetadataChanged = (file: TFile) => {
        const key = file.path;
        const existing = this.pendingTimers.get(key);
        if (existing !== undefined) window.clearTimeout(existing);

        const timer = window.setTimeout(() => {
            this.pendingTimers.delete(key);
            void this.processFileAliases(file);
        }, 500);

        this.pendingTimers.set(key, timer);
    };

    private onFileRenamed = (file: TAbstractFile, oldPath: string) => {
        if (!(file instanceof TFile)) return;
        const aliases = this.aliasCache.getAliases(oldPath) ?? [];
        this.aliasCache.setAliases(file.path, aliases);

        // Best-effort cleanup of old path entry.
        this.aliasCache.setAliases(oldPath, []);
    };

    private onFileDeleted = (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        this.aliasCache.setAliases(file.path, []);
    };
}


