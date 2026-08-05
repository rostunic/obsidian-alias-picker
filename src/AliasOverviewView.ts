import { ItemView, WorkspaceLeaf, Notice, LinkCache, TFile, MarkdownView, Menu } from 'obsidian';
import { AliasCache } from './AliasCache';
import { getBacklinksArray, getKnownFileAliases, normalizeAliases } from './utilities';
import { getAllAliasEntries, moveAliasToOtherFileAsync, renameAliasInFrontmatter } from './BacklinkSearch/AliasUtils';
import { FilePickerItem, FilePickerModal } from './BacklinkSearch/FilePickerModal';
import { BacklinkSearchModal } from './BacklinkSearch/BacklinkSearchModal';
import AliasPickerPlugin from './main';
import { ObsidianFrontmatter } from './obsidian';

type AliasDetails = {
    alias: AliasKey;
    count: number;
    backlinks: { path: string; links: LinkCache[] }[];
};

type BacklinkGroup = {
    path: string;
    file: TFile | null;
    links: LinkCache[];
};

type AliasKey = string & { __brand: 'AliasKey' };
type BacklinkGroupKey = string & { __brand: 'BacklinkGroupKey' };
type LocalStorageExpandedState = {
    aliases: AliasKey[];
    backlinks: BacklinkGroupKey[];
}

export class AliasOverviewView extends ItemView {
    public static readonly Type = 'alias-overview';

    private static readonly PreviewContextChars = 80;
    private static readonly PreviewContextLines = 1;

    private refreshTimeoutId: number | null = null;
    private refreshInProgress = false;
    private refreshRequested = false;
    private eventsRegistered = false;

    // Expanded state: alias keys and backlink group keys
    private expandedAliases: Set<AliasKey> = new Set();
    private expandedBacklinks: Set<BacklinkGroupKey> = new Set();

    // Persist expanded state in localStorage (by file path)
    private getExpandedStateKey(): string {
        const file = this.app.workspace.getActiveFile();
        return file ? `alias-overview-expanded:${file.path}` : '';
    }
    private loadExpandedState() {
        const key = this.getExpandedStateKey();
        if (!key) return;
        const raw = this.app.loadLocalStorage(key) as string | null;
        if (!raw) return;
        const obj = JSON.parse(raw) as LocalStorageExpandedState;
        this.expandedAliases = new Set(obj.aliases || []);
        this.expandedBacklinks = new Set(obj.backlinks || []);
    }
    private saveExpandedState() {
        const key = this.getExpandedStateKey();
        if (!key) return;
        const state: LocalStorageExpandedState = {
            aliases: Array.from(this.expandedAliases),
            backlinks: Array.from(this.expandedBacklinks),
        };
        this.app.saveLocalStorage(key, JSON.stringify(state));
    }

    override getViewType(): string {
        return AliasOverviewView.Type;
    }

    override getDisplayText(): string {
        return 'Alias overview';
    }

    override getIcon(): string {
        return 'list-tree';
    }

    constructor(leaf: WorkspaceLeaf, private aliasCache: AliasCache, private plugin: AliasPickerPlugin) {
        super(leaf);
    }

    override  async onOpen() {
        this.registerRefreshEventsOnce();
        this.scheduleRefresh(0);
        await super.onOpen();
    }

    override async onClose() {
        this.clearRefreshTimeout();
        this.contentEl.empty();
        await super.onClose();
    }

    private clearRefreshTimeout() {
        if (this.refreshTimeoutId !== null) {
            window.clearTimeout(this.refreshTimeoutId);
            this.refreshTimeoutId = null;
        }
    }

    private scheduleRefresh(delayMs = 250) {
        this.clearRefreshTimeout();
        this.refreshTimeoutId = window.setTimeout(() => {
            this.refreshTimeoutId = null;
            this.refresh();
        }, delayMs);
    }

    private registerRefreshEventsOnce() {
        if (this.eventsRegistered) return;
        this.eventsRegistered = true;

        this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleRefresh(0)));
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scheduleRefresh(0)));

        // Metadata changes influence frontmatter aliases and backlinks.
        this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRefresh()));
        this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRefresh()));

        // File edits/renames can change backlinks even before metadata resolves.
        this.registerEvent(this.app.vault.on('modify', () => this.scheduleRefresh()));
        this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));
        this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
        this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
    }

    private createCollapseIcon(parent: HTMLElement, collapsed: boolean) {
        const iconEl = parent.createDiv({ cls: 'tree-item-icon collapse-icon' });
        if (collapsed) iconEl.addClass('is-collapsed');
        // iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
        const svg = iconEl.createSvg("svg", {
            attr: {
                xmlns: "http://www.w3.org/2000/svg",
                width: "24",
                height: "24",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
            },
            cls: ["svg-icon", "right-triangle"],
        });

        svg.createSvg("path", {
            attr: {
                d: "M3 8L12 17L21 8",
            },
        });
        return iconEl;
    }

    private setCollapsedState(container: HTMLElement, iconEl: HTMLElement, childrenEl: HTMLElement, collapsed: boolean) {
        container.toggleClass('is-collapsed', collapsed);
        iconEl.toggleClass('is-collapsed', collapsed);
        childrenEl.style.display = collapsed ? 'none' : '';
    }

    private getFileByPath(path: string): TFile | null {
        const abstract = this.app.vault.getAbstractFileByPath(path);
        return abstract instanceof TFile ? abstract : null;
    }

    private async openFileAt(file: TFile, link: LinkCache) {
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, { active: true });

        const view = leaf.view;
        const line = link.position?.start?.line;
        const col = link.position?.start?.col;
        if (!(view instanceof MarkdownView) || typeof line !== 'number') return;

        view.editor.setCursor({ line, ch: typeof col === 'number' ? col : 0 });
    }

    private async renderBacklinkGroupMatches(matchesEl: HTMLElement, group: BacklinkGroup) {
        matchesEl.empty();
        matchesEl.addClass('search-result-file-matches');

        const file = group.file;
        let content: string | null = null;
        let lines: string[] | null = null;
        if (file) {
            try {
                content = await this.app.vault.cachedRead(file);
                lines = content.split(/\r?\n/);
            } catch {
                content = null;
                lines = null;
            }
        }

        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

        for (const link of group.links) {
            const line0 = link.position?.start?.line;
            const lineNo = typeof line0 === 'number' ? line0 + 1 : null;

            const matchEl = matchesEl.createDiv({ cls: 'search-result-file-match is-clickable' });
            const lineEl = matchEl.createDiv({ cls: 'search-result-file-match-line' });
            if (lineNo) lineEl.appendText(`${lineNo}: `);

            const startOffset = link.position?.start?.offset;
            const endOffset = link.position?.end?.offset;

            if (content && typeof startOffset === 'number' && typeof endOffset === 'number' && endOffset > startOffset) {
                const from = Math.max(0, startOffset - AliasOverviewView.PreviewContextChars);
                const to = Math.min(content.length, endOffset + AliasOverviewView.PreviewContextChars);

                const before = normalize(content.slice(from, startOffset));
                const matched = normalize(content.slice(startOffset, endOffset));
                const after = normalize(content.slice(endOffset, to));

                if (before.length) lineEl.appendText(before + ' ');
                const highlightEl = lineEl.createSpan({ cls: 'search-result-file-matched-text' });
                highlightEl.setText(matched.length ? matched : link.original);
                if (after.length) lineEl.appendText(' ' + after);
            } else {
                // Line-based fallback (still small, no full-file dumps).
                let excerpt = link.original;
                if (lines && typeof line0 === 'number' && line0 >= 0 && line0 < lines.length) {
                    const start = Math.max(0, line0 - AliasOverviewView.PreviewContextLines);
                    const end = Math.min(lines.length - 1, line0 + AliasOverviewView.PreviewContextLines);
                    excerpt = lines.slice(start, end + 1).map(l => l.trim()).join(' ');
                }
                lineEl.setText(lineNo ? `${lineNo}: ${excerpt}` : excerpt);
            }

            if (group.file) {
                matchEl.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    if (!group.file) return;
                    void this.openFileAt(group.file, link);
                });
            }
        }
    }

    private getBacklinkGroupKey(aliasKey: AliasKey, group: BacklinkGroup): BacklinkGroupKey {
        return `${aliasKey}\u0000${group.path}` as BacklinkGroupKey;
    }

    private renderBacklinkGroup(parent: HTMLElement, group: BacklinkGroup, aliasKey: AliasKey) {
        const groupKey = this.getBacklinkGroupKey(aliasKey, group);
        const expanded = this.expandedBacklinks.has(groupKey);
        const groupContainer = parent.createDiv({ cls: 'tree-item search-result' + (expanded ? '' : ' is-collapsed') });
        const headerEl = groupContainer.createDiv({ cls: 'tree-item-self search-result-file-title is-clickable' });

        const iconEl = this.createCollapseIcon(headerEl, !expanded);
        const innerEl = headerEl.createDiv({ cls: 'tree-item-inner', text: group.file?.basename ?? group.path });
        const flairOuter = headerEl.createDiv({ cls: 'tree-item-flair-outer' });
        flairOuter.createSpan({ cls: 'tree-item-flair', text: group.links.length.toString() });

        const matchesEl = groupContainer.createDiv({ cls: 'search-results-children' });
        this.setCollapsedState(groupContainer, iconEl, matchesEl, !expanded);

        let matchesRendered = false;

        const toggleMatches = async () => {
            const currentlyCollapsed = groupContainer.hasClass('is-collapsed');
            const nextCollapsed = !currentlyCollapsed;
            this.setCollapsedState(groupContainer, iconEl, matchesEl, nextCollapsed);
            if (nextCollapsed) {
                this.expandedBacklinks.delete(groupKey);
            } else {
                this.expandedBacklinks.add(groupKey);
                if (!matchesRendered) {
                    matchesRendered = true;
                    await this.renderBacklinkGroupMatches(matchesEl, group);
                }
            }
            this.saveExpandedState();
        };

        iconEl.addEventListener('click', (ev) => {
            ev.stopPropagation();
            void toggleMatches();
        });

        // Clicking the filename navigates to the source file (like core backlinks).
        innerEl.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (!group.file) return;
            void this.openFileAt(group.file, group.links[0]);
        });

        // Default click on the header (outside the icon/text) toggles as well.
        headerEl.addEventListener('click', () => {
            void toggleMatches();
        });

        // If expanded, render matches immediately
        if (expanded && !matchesRendered) {
            matchesRendered = true;
            void this.renderBacklinkGroupMatches(matchesEl, group);
        }
    }

    private renderAliasBacklinks(parent: HTMLElement, aliasDetails: AliasDetails) {
        // Group by source file path, like the core Backlinks view.
        const byPath = new Map<string, LinkCache[]>();
        for (const entry of aliasDetails.backlinks) {
            const existing = byPath.get(entry.path);
            if (existing) existing.push(...entry.links);
            else byPath.set(entry.path, [...entry.links]);
        }

        const groups: BacklinkGroup[] = Array.from(byPath.entries())
            .map(([path, links]) => ({ path, file: this.getFileByPath(path), links }))
            .sort((a, b) => b.links.length - a.links.length);

        if (groups.length === 0) {
            parent.createDiv({ cls: 'search-empty-state', text: 'No backlinks found.' });
            return;
        }

        for (const group of groups) {
            this.renderBacklinkGroup(parent, group, aliasDetails.alias);
        }
    }

    private refresh() {
        if (this.refreshInProgress) {
            this.refreshRequested = true;
            return;
        }
        this.refreshInProgress = true;

        const scrollContainer = this.contentEl;
        const scrollTopBefore = scrollContainer.scrollTop;

        try {
            const file = this.app.workspace.getActiveFile();
            this.contentEl.empty();

            if (!file) {
                this.contentEl.setText('No file selected');
                return;
            }

            this.loadExpandedState();

            const fileCache = this.app.metadataCache.getFileCache(file);
            if (!fileCache) {
                this.contentEl.setText('No file cache found');
                return;
            }

            const frontmatterAliases: string[] = normalizeAliases(fileCache.frontmatter?.aliases);

            const backlinks = getBacklinksArray(this.app, file);
            const aliasCounts: Record<AliasKey, AliasDetails> = {};
            for (const [sourcePath, links] of backlinks) {
                for (const link of links) {
                    if (!link.displayText) continue;
                    const alias = this.getAliasKey(link.displayText);
                    if (!alias) continue;

                    aliasCounts[alias] = (aliasCounts[alias] ?? { alias, count: 0, backlinks: [] });
                    aliasCounts[alias].count++;
                    aliasCounts[alias].backlinks.push({ path: sourcePath, links: [link] });
                }
            }

            const sortedAliases = Object.entries(aliasCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([alias]) => alias);

            const allAliases = [...new Set([file.basename, ...frontmatterAliases, ...sortedAliases])];
            if (allAliases.length === 0) {
                this.contentEl.setText('No aliases found');
                return;
            }

            const searchResultContainer = this.contentEl.createDiv({ cls: 'search-result-container' });
            const childrenRoot = searchResultContainer.createDiv({ cls: 'search-results-children' });

            for (const alias of allAliases) {
                this.renderAliasInRoot(file, alias, aliasCounts, childrenRoot);
            }

            const addButton = this.contentEl.createEl('button', { cls: 'button', text: 'Add all known aliases to current file' });
            addButton.addEventListener('click', () => {
                const aliases = getKnownFileAliases(this.app, file);
                void this.app.fileManager.processFrontMatter(file, (frontmatter: ObsidianFrontmatter) => {
                    const existingRaw = frontmatter?.aliases;
                    const existingAliases: string[] = Array.isArray(existingRaw) ? existingRaw : [];
                    const newAliases = Array.from(aliases).filter(x => !existingAliases.includes(x));
                    if (newAliases.length === 0) {
                        new Notice('No new aliases to add');
                        return;
                    }
                    frontmatter.aliases = [...existingAliases, ...newAliases];
                    new Notice(`Added aliases: ${newAliases.join(', ')}`);
                });
            });

            // Restore scroll position after rendering
            window.requestAnimationFrame(() => {
                scrollContainer.scrollTop = scrollTopBefore;
            });

        } catch (err) {
            this.contentEl.empty();
            const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
            this.contentEl.createEl('pre', { text: message });
        } finally {
            this.refreshInProgress = false;
            if (this.refreshRequested) {
                this.refreshRequested = false;
                this.scheduleRefresh(0);
            }
        }
    }

    private getAliasKey(alias: string): AliasKey {
        return alias.trim() as AliasKey;
    }

    private renderAliasInRoot(file: TFile, alias: string, aliasCounts: Record<AliasKey, AliasDetails>, childrenRoot: HTMLDivElement) {
        const aliasKey = this.getAliasKey(alias);
        const aliasDetails = aliasCounts[aliasKey];

        const expanded = this.expandedAliases.has(aliasKey);
        const aliasEl = childrenRoot.createDiv({ cls: 'tree-item search-result' + (expanded ? '' : ' is-collapsed') });
        const headerEl = aliasEl.createDiv({ cls: 'tree-item-self search-result-file-title is-clickable' });

        const iconEl = this.createCollapseIcon(headerEl, !expanded);
        const treeItemInner = headerEl.createDiv({ cls: 'tree-item-inner', text: alias });
        const flairOuter = headerEl.createDiv({ cls: 'tree-item-flair-outer' });
        flairOuter.createSpan({ cls: 'tree-item-flair', text: (aliasDetails?.count ?? 0).toString() });

        const aliasChildren = aliasEl.createDiv({ cls: 'search-results-children' });
        aliasChildren.addClass('alias-overview-backlinks');
        this.setCollapsedState(aliasEl, iconEl, aliasChildren, !expanded);

        let isRendered = false;

        headerEl.addEventListener('click', () => {
            const currentlyCollapsed = aliasEl.hasClass('is-collapsed');
            const nextCollapsed = !currentlyCollapsed;
            this.setCollapsedState(aliasEl, iconEl, aliasChildren, nextCollapsed);
            if (nextCollapsed) {
                this.expandedAliases.delete(aliasKey);
            } else {
                this.expandedAliases.add(aliasKey);
                if (aliasDetails && !isRendered) {
                    isRendered = true;
                    this.renderAliasBacklinks(aliasChildren, aliasDetails);
                }
                if (!aliasDetails || aliasDetails.count === 0) {
                    aliasChildren.empty();
                    aliasChildren.createDiv({ cls: 'search-empty-state', text: 'No backlinks found.' });
                }
            }
            this.saveExpandedState();
        });

        // Context menu
        this.setupAliasContextMenu(file, headerEl, alias, treeItemInner);


        // If expanded, render backlinks immediately
        if (expanded && aliasDetails && !isRendered) {
            isRendered = true;
            this.renderAliasBacklinks(aliasChildren, aliasDetails);
        }
    }

    private setupAliasContextMenu(file: TFile, headerEl: HTMLDivElement, alias: string, treeItemRootAliasName: HTMLDivElement) {
        headerEl.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const menu = new Menu();
            this.setupAliasContextMenuCopyAlias(menu, alias);
            this.setupAliasContextMenuRename(menu, treeItemRootAliasName, alias, file);
            this.setupAliasContextMenuMoveAliasToOtherFile(menu, alias, file);
            this.setupAliasContextMenuOpenInBacklinkSearch(menu, alias, file);
            menu.showAtPosition({ x: ev.pageX, y: ev.pageY });
        });
    }


    private setupAliasContextMenuRename(menu: Menu, treeItemRootAliasName: HTMLDivElement, alias: string, file: TFile) {
        menu.addItem((item) => {
            item.setTitle('Rename');
            item.onClick(() => {
                treeItemRootAliasName.setText('');
                const inputEl = treeItemRootAliasName.createEl('input', { type: 'text', value: alias });
                inputEl.focus();
                inputEl.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        removeInput();
                    }
                    if (event.key === 'Enter') {
                        const newAlias = inputEl.value.trim();
                        if (newAlias && newAlias !== alias) {
                            treeItemRootAliasName.setText(newAlias);
                            void renameAliasInFrontmatter(this.app, file, alias, newAlias);
                        }
                        inputEl.remove();
                    }
                });
                inputEl.addEventListener('blur', () => {
                    removeInput();
                });

                function removeInput() {
                    treeItemRootAliasName.setText(alias);
                    inputEl.remove();
                }
            });
        });
    }

    private setupAliasContextMenuCopyAlias(menu: Menu, alias: string) {
        menu.addItem((item) => {
            item.setTitle('Copy alias to clipboard');
            item.onClick(() => {
                navigator.clipboard.writeText(alias).then(() => {
                    new Notice(`Copied alias "${alias}" to clipboard`);
                }).catch((err) => {
                    new Notice(`Failed to copy alias: ${err}`);
                }
                );
            });
        });
    }

    private setupAliasContextMenuMoveAliasToOtherFile(menu: Menu, alias: string, file: TFile) {
        menu.addItem((item) => {
            item.setTitle('Move alias to another file');
            item.onClick(() => {
                const allFiles = this.app.vault.getFiles();
                const aliasEntries = getAllAliasEntries(this.app, allFiles, true);
                const filePicker = new FilePickerModal(this.app, aliasEntries, (filePickerItem) => {
                    if (filePickerItem.file) {
                        void moveAliasToOtherFileAsync(this.app, file, filePickerItem.file, alias);
                    }
                })
                filePicker.setTitle(`Move alias "${alias}" to another file`);
                filePicker.setPlaceholder(`Search for the target file of alias "${alias}..."`);
                filePicker.open();
            });
        });
    }
    private setupAliasContextMenuOpenInBacklinkSearch(menu: Menu, alias: string, file: TFile) {
        menu.addItem((item) => {
            item.setTitle('Open in backlink search as exact alias');
            item.onClick(() => {
                const filePickerItem: FilePickerItem = { file, alias, displayText: alias };
                const backlinkSearchModal = new BacklinkSearchModal(this.app, this.plugin.settings, [filePickerItem]);
                backlinkSearchModal.open();
            });
        });
    }
}