import { ItemView, WorkspaceLeaf, Notice, LinkCache, TFile, MarkdownView } from 'obsidian';
import { AliasCache } from './AliasCache';
import { getBacklinksArray, getKnownFileAliases } from './utilities';

type AliasDetails = {
    alias: string;
    count: number;
    backlinks: { path: string; links: LinkCache[] }[];
};

type BacklinkGroup = {
    path: string;
    file: TFile | null;
    links: LinkCache[];
};

export class AliasOverviewView extends ItemView {
    public static readonly Type = 'alias-overview';

    private static readonly PreviewContextChars = 80;
    private static readonly PreviewContextLines = 1;

    private refreshTimeoutId: number | null = null;
    private refreshInProgress = false;
    private refreshRequested = false;
    private eventsRegistered = false;

    override getViewType(): string {
        return AliasOverviewView.Type;
    }

    override getDisplayText(): string {
        return 'Alias Overview';
    }

    constructor(leaf: WorkspaceLeaf, private aliasCache: AliasCache) {
        super(leaf);
    }

    override async onOpen() {
        this.registerRefreshEventsOnce();
        this.scheduleRefresh(0);
    }

    override async onClose() {
        if (this.refreshTimeoutId !== null) {
            window.clearTimeout(this.refreshTimeoutId);
            this.refreshTimeoutId = null;
        }
        this.contentEl.empty();
    }

    private scheduleRefresh(delayMs = 250) {
        if (this.refreshTimeoutId !== null) {
            window.clearTimeout(this.refreshTimeoutId);
            this.refreshTimeoutId = null;
        }
        this.refreshTimeoutId = window.setTimeout(() => {
            this.refreshTimeoutId = null;
            void this.refresh();
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
        const iconEl = parent.createEl('div', { cls: 'tree-item-icon collapse-icon' });
        if (collapsed) iconEl.addClass('is-collapsed');
        iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
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

            const matchEl = matchesEl.createEl('div', { cls: 'search-result-file-match is-clickable' });
            const lineEl = matchEl.createEl('div', { cls: 'search-result-file-match-line' });
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
                const highlightEl = lineEl.createEl('span', { cls: 'search-result-file-matched-text' });
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
                matchEl.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    await this.openFileAt(group.file as TFile, link);
                });
            }
        }
    }

    private renderBacklinkGroup(parent: HTMLElement, group: BacklinkGroup) {
        const groupContainer = parent.createEl('div', { cls: 'tree-item search-result is-collapsed' });
        const headerEl = groupContainer.createEl('div', { cls: 'tree-item-self search-result-file-title is-clickable' });

        const iconEl = this.createCollapseIcon(headerEl, true);
        const innerEl = headerEl.createEl('div', { cls: 'tree-item-inner', text: group.file?.basename ?? group.path });
        const flairOuter = headerEl.createEl('div', { cls: 'tree-item-flair-outer' });
        flairOuter.createEl('span', { cls: 'tree-item-flair', text: group.links.length.toString() });

        const matchesEl = groupContainer.createEl('div', { cls: 'search-results-children' });
        this.setCollapsedState(groupContainer, iconEl, matchesEl, true);

        let matchesRendered = false;

        const toggleMatches = async () => {
            const currentlyCollapsed = groupContainer.hasClass('is-collapsed');
            const nextCollapsed = !currentlyCollapsed;
            this.setCollapsedState(groupContainer, iconEl, matchesEl, nextCollapsed);

            if (!nextCollapsed && !matchesRendered) {
                matchesRendered = true;
                await this.renderBacklinkGroupMatches(matchesEl, group);
            }
        };

        iconEl.addEventListener('click', (ev) => {
            ev.stopPropagation();
            void toggleMatches();
        });

        // Clicking the filename navigates to the source file (like core backlinks).
        innerEl.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            if (!group.file) return;
            await this.openFileAt(group.file, group.links[0]);
        });

        // Default click on the header (outside the icon/text) toggles as well.
        headerEl.addEventListener('click', () => {
            void toggleMatches();
        });
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
            parent.createEl('div', { cls: 'search-empty-state', text: 'No backlinks found.' });
            return;
        }

        for (const group of groups) {
            this.renderBacklinkGroup(parent, group);
        }
    }

    private async refresh() {
        if (this.refreshInProgress) {
            this.refreshRequested = true;
            return;
        }
        this.refreshInProgress = true;

        try {
            const file = this.app.workspace.getActiveFile();
            this.contentEl.empty();

            if (!file) {
                this.contentEl.setText('No file selected');
                return;
            }

            const fileCache = this.app.metadataCache.getFileCache(file);
            if (!fileCache) {
                this.contentEl.setText('No file cache found');
                return;
            }

            const aliasesRaw = fileCache.frontmatter?.aliases;
            const frontmatterAliases: string[] = Array.isArray(aliasesRaw) ? aliasesRaw : [];

            const backlinks = getBacklinksArray(this.app, file);
            const aliasCounts: Record<string, AliasDetails> = {};
            for (const [sourcePath, links] of backlinks) {
                for (const link of links) {
                    if (!link.displayText) continue;
                    const alias = link.displayText.trim();
                    if (!alias) continue;

                    aliasCounts[alias] = (aliasCounts[alias] ?? { alias, count: 0, backlinks: [] });
                    aliasCounts[alias].count++;
                    aliasCounts[alias].backlinks.push({ path: sourcePath, links: [link] });
                }
            }

            const sortedAliases = Object.entries(aliasCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([alias]) => alias);

            const allAliases = [...new Set([...frontmatterAliases, ...sortedAliases])];
            if (allAliases.length === 0) {
                this.contentEl.setText('No aliases found');
                return;
            }

            const searchResultContainer = this.contentEl.createEl('div', { cls: 'search-result-container' });
            const childrenRoot = searchResultContainer.createEl('div', { cls: 'search-results-children' });

            const renderedAliases = new Set<string>();
            for (const alias of allAliases) {
                const aliasKey = alias.trim();
                const aliasDetails = aliasCounts[aliasKey];

                const aliasEl = childrenRoot.createEl('div', { cls: 'tree-item search-result is-collapsed' });
                const headerEl = aliasEl.createEl('div', { cls: 'tree-item-self search-result-file-title is-clickable' });

                const iconEl = this.createCollapseIcon(headerEl, true);
                headerEl.createEl('div', { cls: 'tree-item-inner', text: alias });
                const flairOuter = headerEl.createEl('div', { cls: 'tree-item-flair-outer' });
                flairOuter.createEl('span', { cls: 'tree-item-flair', text: (aliasDetails?.count ?? 0).toString() });

                const aliasChildren = aliasEl.createEl('div', { cls: 'search-results-children' });
                aliasChildren.addClass('alias-overview-backlinks');
                this.setCollapsedState(aliasEl, iconEl, aliasChildren, true);

                headerEl.addEventListener('click', () => {
                    const currentlyCollapsed = aliasEl.hasClass('is-collapsed');
                    const nextCollapsed = !currentlyCollapsed;
                    this.setCollapsedState(aliasEl, iconEl, aliasChildren, nextCollapsed);

                    if (!nextCollapsed && aliasDetails && !renderedAliases.has(aliasKey)) {
                        renderedAliases.add(aliasKey);
                        this.renderAliasBacklinks(aliasChildren, aliasDetails);
                    }

                    if (!nextCollapsed && (!aliasDetails || aliasDetails.count === 0)) {
                        aliasChildren.empty();
                        aliasChildren.createEl('div', { cls: 'search-empty-state', text: 'No backlinks found.' });
                    }
                });
            }

            const addButton = this.contentEl.createEl('button', { text: 'Add all known aliases to current file' });
            addButton.addEventListener('click', () => {
                const aliases = getKnownFileAliases(this.app, file);
                this.app.fileManager.processFrontMatter(file, async (frontmatter) => {
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
}
