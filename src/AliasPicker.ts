import { App, Editor, FuzzySuggestModal, LinkCache, TFile, parseLinktext } from 'obsidian';

export class AliasPicker extends FuzzySuggestModal<string> {
	getItems(): string[] {
		return this.aliases;
	}
	getItemText(item: string): string {
		return item;
	}
	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.chooseItem(item);
	}
	constructor(app: App, private targetFile: TFile, private link: LinkCache, private aliases: string[],
		private editor: Editor
	) {
		super(app);
	}
	chooseItem(item: string) {
		const start = this.editor.offsetToPos(this.link.position.start.offset);
		const end = this.editor.offsetToPos(this.link.position.end.offset);
		const newLink = AliasPicker.generateLinkWithAlias(this.app, this.targetFile, item, this.link);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length);
		this.editor.setCursor(newPosition);
	}

	public static generateLinkWithAlias(app: App, file: TFile, alias: string, oldLink: LinkCache) {
		const parsed = parseLinktext(oldLink.original);
		return app.fileManager.generateMarkdownLink(file, parsed.path, parsed.subpath.replace(/\)+$/, ''), alias);
	}
}
