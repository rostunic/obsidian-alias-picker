import { App, TFile, LinkCache } from 'obsidian';
import { AdvancedMetadataCache } from './obsidian';


export function getBacklinksArray(app: App, file: TFile) {
	// Prefer Obsidian's internal backlinks API if available, but it is not stable across versions.
	// In some builds it can throw at runtime, so we must fall back to a public-API-based approach.
	try {
		const getBacklinksForFile = (app.metadataCache as AdvancedMetadataCache).getBacklinksForFile;
		if (typeof getBacklinksForFile === 'function') {
			const backlinksObject = (app.metadataCache as AdvancedMetadataCache).getBacklinksForFile(file);
			if (backlinksObject?.data) return Array.from(backlinksObject.data.entries());
		}
	} catch {
		// Fall through to public API fallback.
	}

	// Fallback: compute backlinks by scanning the set of files that resolved-links to the target,
	// then collecting the LinkCache entries that resolve to the same destination.
	const targetPath = file.path;
	const resolved = (app.metadataCache as unknown as { resolvedLinks?: Record<string, Record<string, number>> }).resolvedLinks;
	if (!resolved) return [];

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

export function getKnownFileAliases(app: App, currentFile: TFile) {
	const backlinksToCurrentFile = getBacklinksArray(app, currentFile);
	const aliases = new Set<string>();
	aliases.add(currentFile.basename);
	for (const link of backlinksToCurrentFile.flatMap(x => x[1])) {
		if (link.displayText)
			aliases.add(link.displayText);
	}
	return aliases;
}

