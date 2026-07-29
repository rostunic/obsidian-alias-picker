// src/BacklinkSearch/BacklinkEngine.ts

import {
    App,
    TFile
} from "obsidian";

import { getBacklinksArray } from "../utilities";

export class BacklinkEngine {

    private cache =
        new Map<string, Set<string>>();

    constructor(
        private readonly app: App
    ) { }

    async getIntersection(
        files: TFile[]
    ): Promise<TFile[]> {

        if (files.length === 0) {
            return [];
        }

        const backlinkSets = await Promise.all(files.map(file => this.getBacklinks(file)));
        const intersectedBacklinks = backlinkSets.reduce((intersection, current) => intersection.intersection(current),);

        return [...intersectedBacklinks]
            .map(path => this.app.vault.getAbstractFileByPath(path))
            .filter((file): file is TFile => file instanceof TFile);
    }

    async getPlusCandidates(
        selectedFiles: TFile[],
        excludedFiles: TFile[] = []
    ): Promise<TFile[]> {

        if (selectedFiles.length === 0) {
            return this.app.vault.getMarkdownFiles();
        }

        const intersection = await this.getIntersection(selectedFiles);

        // Excluded Files ausschließen
        const relevantBacklinks = intersection.filter(
            file => !excludedFiles.some(excluded => excluded.path === file.path)
        );

        const result = new Set<string>();

        for (const file of relevantBacklinks) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.links) {
                for (const link of cache.links) {
                    const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
                    if (dest instanceof TFile) {
                        result.add(dest.path);
                    }
                }
            }
        }


        return [...result]
            .map(path =>
                this.app.vault
                    .getAbstractFileByPath(path)
            )
            .filter((file): file is TFile =>
                file instanceof TFile
            );
    }

    async getMinusCandidates(
        selectedFiles: TFile[],
        excludedFiles: TFile[] = []
    ): Promise<TFile[]> {

        if (selectedFiles.length === 0) {
            return this.app.vault.getMarkdownFiles();
        }

        const intersection = await this.getIntersection(selectedFiles);

        // Excluded Files ausschließen
        const relevantBacklinks = intersection.filter(
            file => !excludedFiles.some(excluded => excluded.path === file.path)
        );

        return relevantBacklinks;
    }

    private async getBacklinks(
        file: TFile
    ): Promise<Set<string>> {

        const cached = this.cache.get(file.path);

        if (cached) {
            return cached;
        }

        const result =
            new Set<string>();

        for (const [path] of getBacklinksArray(this.app, file)) {
            result.add(path);
        }

        this.cache.set(file.path, result);

        return result;
    }

}
