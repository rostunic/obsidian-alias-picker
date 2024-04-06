import { App, BlockCache, Editor, FuzzySuggestModal, LinkCache, TFile, parseLinktext } from 'obsidian';

export class BlockPicker extends FuzzySuggestModal<BlockCache> {
	getItems(): BlockCache[] {
		return this.Blocks;
	}
	getItemText(item: BlockCache): string {
		const text = this.targetFileContent.slice(item.position.start.offset, item.position.end.offset);
		return text;
	}
	onChooseItem(item: BlockCache, evt: MouseEvent | KeyboardEvent): void {
		this.chooseItem(item);
	}
	constructor(app: App, private targetFile: TFile, private targetFileContent: string, private link: LinkCache, private Blocks: BlockCache[],
		private editor: Editor
	) {
		super(app);
	}
	chooseItem(block: BlockCache) {
		const start = this.editor.offsetToPos(this.link.position.start.offset);
		const end = this.editor.offsetToPos(this.link.position.end.offset);
		const parsed = parseLinktext(this.link.original);
		const newLink = this.app.fileManager.generateMarkdownLink(this.targetFile, parsed.path, "#^" + block.id, this.link.displayText);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length + 1);
		this.editor.setCursor(newPosition);
	}
}
