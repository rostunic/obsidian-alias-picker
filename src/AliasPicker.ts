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
		const parsed = parseLinktext(this.link.original);
		const newLink = this.app.fileManager.generateMarkdownLink(this.targetFile, parsed.path, parsed.subpath.replace(/\)+$/, ''), item);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length);
		this.editor.setCursor(newPosition);
	}
}
