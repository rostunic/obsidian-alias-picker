// src/BacklinkSearch/BacklinkEngine.ts

import {
    App,
    LinkCache,
    TFile
} from "obsidian";

import { getBacklinksArray } from "../utilities";
import { FilePickerItem } from "./FilePickerModal";
import { AliasEntry, getAliasesAndBaseName, getAliasesForFile } from "./AliasUtils";

export class BacklinkEngine {

    private cache =
        new Map<string, [string, LinkCache[]][]>();

    constructor(
        private readonly app: App
    ) { }

    async getIntersection(
        files: TFile[],
        exactAliases: FilePickerItem[]
    ): Promise<TFile[]> {

        if (files.length + exactAliases.length === 0) {
            return [];
        }

        const backlinkSets = files.map(file => this.getBacklinkFiles(file));
        const exactBacklinkSets = exactAliases.map(aliasItem => {
            const alias = aliasItem.alias;
            const backlinks = this.getBacklinks(aliasItem.file);
            return new Set([...backlinks].filter(backlinkFile => {
                return backlinkFile[1].some(link => link.displayText == alias);
            }).map(backlinkFile => backlinkFile[0]));
        });
        const allBacklinkSets = [...backlinkSets, ...exactBacklinkSets];
        const intersectedBacklinks = allBacklinkSets.reduce((intersection, current) => intersection.intersection(current),);

        return [...intersectedBacklinks]
            .map(path => this.app.vault.getAbstractFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);
    }

    async getPlusCandidates(
        selectedFiles: TFile[],
        exactAliases: FilePickerItem[],
        excludedFiles: TFile[] = [],
        includeAllAliases: boolean
    ): Promise<AliasEntry[]> {

        if (selectedFiles.length === 0 && exactAliases.length === 0) {
            return this.app.vault.getMarkdownFiles().flatMap(file => [...getAliasesAndBaseName(this.app, file)]
                .map(alias => ({ alias, file })));
        }

        const intersection = await this.getIntersection(selectedFiles, exactAliases);

        // Excluded Files ausschließen
        const relevantBacklinks = intersection.filter(
            file => !excludedFiles.some(excluded => excluded.path === file.path)
        );

        const result = new Map<string, AliasEntry>();

        for (const file of relevantBacklinks) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.links) {
                for (const link of cache.links) {
                    const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
                    if (dest instanceof TFile) {
                        if (includeAllAliases) {
                            const aliases = getAliasesAndBaseName(this.app, dest);
                            for (const alias of aliases) {
                                result.set(`${dest.path}_${alias}`, { alias: alias, file: dest });
                            }
                        } else
                            result.set(`${dest.path}_${link.displayText}`, { alias: link.displayText ?? dest.basename, file: dest });
                    }
                }
            }
        }


        return [...result].map(x => x[1]);

    }

    async getMinusCandidates(
        selectedFiles: TFile[],
        exactAliases: FilePickerItem[],
        excludedFiles: TFile[] = []
    ): Promise<AliasEntry[]> {

        if (selectedFiles.length === 0 && exactAliases.length === 0) {
            return this.app.vault.getMarkdownFiles().flatMap(file => [...getAliasesAndBaseName(this.app, file)]
                .map(alias => ({ alias, file })));
        }

        const intersection = await this.getIntersection(selectedFiles, exactAliases);

        // Excluded Files ausschließen
        const relevantBacklinks = intersection.filter(
            file => !excludedFiles.some(excluded => excluded.path === file.path)
        );

        return relevantBacklinks.flatMap(file => [...getAliasesAndBaseName(this.app, file)].map(alias => ({ alias, file })));
    }

    private getBacklinkFiles(
        file: TFile
    ): Set<string> {

        const cached = this.getBacklinks(file);

        const result = new Set<string>();
        for (const [path] of cached) {
            result.add(path);
        }

        return result;
    }


    private getBacklinks(file: TFile) {
        const cached = this.cache.get(file.path);
        if (cached) return cached;

        const backlinks = getBacklinksArray(this.app, file);
        this.cache.set(file.path, backlinks);
        return backlinks;
    }
}
