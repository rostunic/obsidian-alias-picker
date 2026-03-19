export class AliasCache {
	private cache: Record<string, string[]> = {};
	public getAliases(filePath: string): string[] | undefined {
		return this.cache[filePath];
	}
	public setAliases(filePath: string, aliases: string[]) {
		this.cache[filePath] = aliases;
	}
}
