import { App, Editor, FuzzySuggestModal, LinkCache, TFile } from 'obsidian';
import { AliasPicker } from './AliasPicker';

export class PathPicker extends FuzzySuggestModal<string> {
	getItems(): string[] {
		return this.targetFiles.map(file => file.path);
	}
	getItemText(item: string): string {
		return item;
	}
	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.chooseItem(item);
	}
	constructor(app: App, private targetFiles: TFile[], private link: LinkCache,
		private editor: Editor
	) {
		super(app);
	}
	chooseItem(item: string) {
		const start = this.editor.offsetToPos(this.link.position.start.offset);
		const end = this.editor.offsetToPos(this.link.position.end.offset);
		const targetFile = this.targetFiles.find(file => file.path === item);
		if(!targetFile) return;
		const newLink = AliasPicker.generateLinkWithAlias(this.app, targetFile, this.link.displayText ?? item, this.link);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length);
		this.editor.setCursor(newPosition);
	}
}
