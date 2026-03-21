export class AliasCache {
	private cache: Record<string, string[]> = {};
	public getAliases(filePath: string): string[] | undefined {
		return this.cache[filePath];
	}
	public setAliases(filePath: string, aliases: string[]) {
		this.cache[filePath] = aliases;
	}

	public getFilesWithAlias(alias: string): string[] {
		const target = alias.toLowerCase();
		const result: string[] = [];
		for (const [filePath, aliases] of Object.entries(this.cache)) {
			if (!Array.isArray(aliases)) continue;
			if (aliases.some(a => typeof a === 'string' && a.toLowerCase() === target)) {
				result.push(filePath);
			}
		}
		return result;
	}
}
