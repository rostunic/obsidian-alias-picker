export class AliasCache {
	private cache: Record<string, string[]> = {};
	public getAliases(filePath: string): string[] | undefined {
		return this.cache[filePath];
	}
	public setAliases(filePath: string, aliases: string[]) {
		this.cache[filePath] = aliases;
	}

	public getFilesWithAlias(alias: string): string[] {
		return Object.entries(this.cache)
			.filter(([_, aliases]) => aliases.includes(alias))
			.map(([filePath, _]) => filePath);
	}
}
