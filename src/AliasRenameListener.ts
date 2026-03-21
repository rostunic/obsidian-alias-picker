import { App, TFile, CachedMetadata, Notice } from 'obsidian';
import { AliasCache } from './AliasCache';
import { AliasPicker } from './AliasPicker';
import { getBacklinksArray } from './utilities';

export class AliasRenameListener {
    constructor(private app: App, private aliasCache: AliasCache) {
    }
    public startListening() {
        //for each file, load the aliases and store them in the cache
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache) continue;
            const frontmatter = cache.frontmatter;
            if (!frontmatter) continue;
            const aliases: string[] | undefined = frontmatter.aliases;
            if (!aliases) continue;
            this.aliasCache.setAliases(file.path, aliases);
        }
        this.app.metadataCache.on('changed', this.onMetadataChanged);
    }
    public stopListening() {
        this.app.metadataCache.off('changed', this.onMetadataChanged as (...data: unknown[]) => unknown);
    }
    private onMetadataChanged = async (file: TFile, _data: string, cache: CachedMetadata) => {
        if (!cache) return;
        const frontmatter = cache.frontmatter;
        if (!frontmatter) return;
        const aliases: string[] | undefined = frontmatter.aliases;
        if (!aliases) return;
        const oldAliases = this.aliasCache.getAliases(file.path);
        const addedAliases = aliases.filter(x => !oldAliases?.includes(x));
        const removedAliases = oldAliases?.filter(x => !aliases.includes(x)) ?? [];
        if (addedAliases.length === 1 && removedAliases.length === 1) {
            //if only one alias was added and one removed, we can assume that the user renamed an alias, so we update all links with the old alias to the new alias
            const oldAlias = removedAliases[0];
            const newAlias = addedAliases[0];
            const backlinksArray = getBacklinksArray(this.app, file);
            const backlinks = backlinksArray.map(([path, links]) => {
                const filteredLinks = links.filter(link => link.displayText === oldAlias);
                return { path, links: filteredLinks };
            }).filter(x => x.links.length > 0);
            for (const backlink of backlinks) {
                const backlinkFile = this.app.vault.getFileByPath(backlink.path);
                if (!backlinkFile) continue;
                const fileContent = await this.app.vault.read(backlinkFile);
                const newContent = backlink.links.reduce((content, link) => {
                    const oldText = link.original;
                    const newText = AliasPicker.generateLinkWithAlias(this.app, file, newAlias, link);
                    return content.replace(oldText, newText);
                }, fileContent);
                await this.app.vault.modify(backlinkFile, newContent);
                new Notice(`Renamed alias in ${backlinkFile.path}`);
            }
            new Notice(`Renamed alias "${oldAlias}" to "${newAlias}" in ${backlinks.length} files`);
        }
        this.aliasCache.setAliases(file.path, aliases);
    };
}


