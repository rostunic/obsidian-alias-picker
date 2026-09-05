import { App, TFile, LinkCache, TFolder } from 'obsidian';


export function normalizeAliases(raw: unknown): string[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim());
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		return trimmed.length ? [trimmed] : [];
	}
	return [];
}
export function getKnownAliasesOfAllFiles(app: App, interpretFileNameAsAlias: boolean): Map<string, Set<string>> {
	const result = new Map<string, Set<string>>();
	if (interpretFileNameAsAlias) {
		for (const file of app.vault.getMarkdownFiles()) {
			result.set(file.path, new Set([file.basename]));
		}
	}
	const resolvedLinks = app.metadataCache.resolvedLinks;
	for (const [sourcePath] of Object.entries(resolvedLinks)) {
		const sourceFile = app.vault.getFileByPath(sourcePath);
		if (!sourceFile) continue;
		const cache = app.metadataCache.getFileCache(sourceFile);
		if (!cache) continue;
		const links = cache.links ?? [];
		for (const link of links) {
			const targetFile = app.metadataCache.getFirstLinkpathDest(link.link, sourceFile.path);
			if (!targetFile) continue;
			const targetPath = targetFile.path;
			const existing = result.get(targetPath);
			if (existing) {
				existing.add(link.displayText ?? targetFile.basename);
			} else {
				result.set(targetPath, new Set([link.displayText ?? targetFile.basename]));
			}
		}
	}
	return result;
}

export function getBacklinksArray(app: App, file: TFile) {
	// Prefer Obsidian's internal backlinks API if available, but it is not stable across versions.
	// In some builds it can throw at runtime, so we must fall back to a public-API-based approach.
	// try {
	// 	const metadataCache = app.metadataCache as AdvancedMetadataCache;
	// 	if (typeof metadataCache.getBacklinksForFile === 'function') {
	// 		const backlinksObject = metadataCache.getBacklinksForFile(file);
	// 		if (backlinksObject?.data) return Array.from(backlinksObject.data.entries());
	// 	}
	// } catch {
	// 	// Fall through to public API fallback.
	// }

	// Fallback: compute backlinks by scanning the set of files that resolved-links to the target,
	// then collecting the LinkCache entries that resolve to the same destination.
	const targetPath = file.path;
	const resolved = app.metadataCache.resolvedLinks;

	const result = new Map<string, LinkCache[]>();
	for (const [sourcePath, dests] of Object.entries(resolved)) {
		if (!dests || !dests[targetPath]) continue;
		const sourceFile = app.vault.getFileByPath(sourcePath);
		if (!sourceFile) continue;

		const cache = app.metadataCache.getFileCache(sourceFile);
		const links = cache?.links ?? [];

		for (const link of links) {
			const dest = app.metadataCache.getFirstLinkpathDest(link.link, sourceFile.path);
			if (dest?.path !== targetPath) continue;
			const existing = result.get(sourcePath);
			if (existing) existing.push(link);
			else result.set(sourcePath, [link]);
		}
	}

	return Array.from(result.entries());
}

export function getKnownFileAliases(app: App, currentFile: TFile, interpretFileNameAsAlias: boolean, allKnownAliases: Map<string, Set<string>> | undefined = undefined): Set<string> {
	if (allKnownAliases) {
		return allKnownAliases.get(currentFile.path) ?? new Set<string>();
	}
	const backlinksToCurrentFile = getBacklinksArray(app, currentFile);
	const aliases = new Set<string>();
	if (interpretFileNameAsAlias) {
		aliases.add(currentFile.basename);
	}
	for (const link of backlinksToCurrentFile.flatMap(x => x[1])) {
		if (link.displayText)
			aliases.add(link.displayText);
	}
	return aliases;
}

export function getParentFolders(file: TFile): TFolder[] {
	const folders: TFolder[] = [];
	let currentFolder = file.parent;
	while (currentFolder) {
		folders.push(currentFolder);
		currentFolder = currentFolder.parent;
	}
	return folders;
}