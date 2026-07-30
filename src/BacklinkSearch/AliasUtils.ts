// src/BacklinkSearch/AliasUtils.ts

import { TFile, App } from "obsidian";

export interface AliasEntry {
    alias: string;
    file: TFile;
}

export function getAliasesForFile(
    app: App,
    file: TFile
): string[] {
    const aliases =
        app.metadataCache
            .getFileCache(file)
            ?.frontmatter
            ?.aliases
        ?? [];

    return Array.isArray(aliases)
        ? aliases
        : [aliases];
}

export function getAllAliasEntries(
    app: App,
    files: TFile[]
): AliasEntry[] {
    const result: AliasEntry[] = [];

    for (const file of files) {
        const aliases = getAliasesForFile(app, file);

        for (const alias of aliases) {
            result.push({ alias, file });
        }
    }

    return result;
}

export function getAliasesAndBaseName(app: App, dest: TFile) {
    const aliases = new Set<string>();
    aliases.add(dest.basename);
    getAliasesForFile(app, dest).forEach(alias => aliases.add(alias));
    return aliases;
}
