// src/BacklinkSearch/AliasUtils.ts

import { TFile, App, Notice } from "obsidian";
import { getBacklinksArray } from "../utilities";
import { AliasPicker } from "../AliasPicker";

export interface AliasEntry {
    alias: string;
    file: TFile;
}

export function getAliasesForFile(
    app: App,
    file: TFile,
    includeBasename: boolean
): string[] {
    const aliases =
        app.metadataCache
            .getFileCache(file)
            ?.frontmatter
            ?.aliases
        ?? [];
    if(includeBasename && !aliases.includes(file.basename)) {
        return [file.basename, ...aliases];
    }

    return Array.isArray(aliases)
        ? aliases
        : [aliases];
}

export function getAllAliasEntries(
    app: App,
    files: TFile[],
    includeBasename: boolean
): AliasEntry[] {
    const result: AliasEntry[] = [];

    for (const file of files) {
        const aliases = getAliasesForFile(app, file, includeBasename);

        for (const alias of aliases) {
            result.push({ alias, file });
        }
    }

    return result;
}

export function getAliasesAndBaseName(app: App, dest: TFile) {
    const aliases = new Set<string>();
    getAliasesForFile(app, dest, true).forEach(alias => aliases.add(alias));
    return aliases;
}

export async function moveAliasToOtherFileAsync(app: App, file: TFile, otherFile: TFile, alias: string) {
    await moveAliasesInBacklinksToOtherFileAsync(app, file, otherFile, alias);
    await removeAliasFromFileFrontmatterAsync(app, file, alias);
    await addAliasToFileFrontmatterAsync(app, otherFile, alias);
    new Notice(`Moved alias "${alias}" from ${file.path} to ${otherFile.path} and updated backlinks.`);
}

export function renameAliasInFrontmatter(app: App, file: TFile, oldAlias: string, newAlias: string) {
    app.fileManager.processFrontMatter(file, (frontmatter) => {
        const existingRaw = frontmatter?.aliases;
        const existingAliases: string[] = Array.isArray(existingRaw) ? existingRaw : [];
        const updatedAliases = existingAliases.map(a => a === oldAlias ? newAlias : a);
        frontmatter.aliases = updatedAliases;
    });
}

export async function removeAliasFromFileFrontmatterAsync(app: App, file: TFile, alias: string) {
    app.fileManager.processFrontMatter(file, (frontmatter) => {
        const existingRaw = frontmatter?.aliases;
        const existingAliases: string[] = Array.isArray(existingRaw) ? existingRaw : [];
        const updatedAliases = existingAliases.filter(a => a !== alias);
        frontmatter.aliases = updatedAliases;
    });
    new Notice(`Removed alias "${alias}" from ${file.path}`);
}
export async function addAliasToFileFrontmatterAsync(app: App, file: TFile, alias: string) {
    app.fileManager.processFrontMatter(file, (frontmatter) => {
        const existingRaw = frontmatter?.aliases;
        const existingAliases: string[] = Array.isArray(existingRaw) ? existingRaw : [];
        if (!existingAliases.includes(alias)) {
            existingAliases.push(alias);
        }
        frontmatter.aliases = existingAliases;
    });
    new Notice(`Added alias "${alias}" to ${file.path}`);
}


export async function renameAliasesInBacklinksAsync(app: App, file: TFile, oldAlias: string, newAlias: string) {
    const backlinks = getBacklinksForAlias(app, file, oldAlias);

    for (const backlink of backlinks) {
        const backlinkFile = app.vault.getFileByPath(backlink.path);
        if (!backlinkFile) continue;

        const fileContent = await app.vault.cachedRead(backlinkFile);
        const newContent = backlink.links.reduce((content, link) => {
            const oldText = link.original;
            const newText = AliasPicker.generateLinkWithAlias(app, file, newAlias, link);
            return content.replace(oldText, newText);
        }, fileContent);

        if (newContent !== fileContent) {
            await app.vault.modify(backlinkFile, newContent);
            new Notice(`Renamed alias in ${backlinkFile.path}`);
        }
    }

    new Notice(`Renamed alias "${oldAlias}" to "${newAlias}" in ${backlinks.length} files`);
}

export async function moveAliasesInBacklinksToOtherFileAsync(app: App, file: TFile, otherFile: TFile, alias: string) {
    const backlinks = getBacklinksForAlias(app, file, alias);

    for (const backlink of backlinks) {
        const backlinkFile = app.vault.getFileByPath(backlink.path);
        if (!backlinkFile) continue;

        const fileContent = await app.vault.cachedRead(backlinkFile);
        const newContent = backlink.links.reduce((content, link) => {
            const oldText = link.original;
            const newText = AliasPicker.generateLinkWithAlias(app, otherFile, link.displayText ?? alias, link);
            return content.replace(oldText, newText);
        }, fileContent);

        if (newContent !== fileContent) {
            await app.vault.modify(backlinkFile, newContent);
            new Notice(`Moved alias "${alias}" in ${backlinkFile.path}`);
        }
    }

    new Notice(`Moved alias "${alias}" from ${file.path} to ${otherFile.path} in ${backlinks.length} files`);
}

function getBacklinksForAlias(app: App, file: TFile, oldAlias: string) {
    const backlinksArray = getBacklinksArray(app, file);
    const backlinks = backlinksArray
        .map(([path, links]) => ({ path, links: links.filter(link => link.displayText === oldAlias) }))
        .filter(x => x.links.length > 0);
    return backlinks;
}
