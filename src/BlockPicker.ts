import { App, BlockCache, Editor, FuzzyMatch, FuzzySuggestModal, LinkCache, TFile, parseLinktext, MarkdownRenderer, Component } from 'obsidian';

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
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length);
		this.editor.setCursor(newPosition);
	}

	override renderSuggestion(item: FuzzyMatch<BlockCache>, el: HTMLElement): void {
		let text = this.getItemText(item.item);
		for (const match of item.match.matches.sort((a, b) => b[0] - a[0])) {
			const start = match[0];
			const end = match[1];
			text = `${text.slice(0, start)}<b style="background-color: #00000081; color: yellow;">${text.slice(start, end)}</b>${text.slice(end)}`;
		}

		const temp = document.createElement("div");
		const component = new Component();

		MarkdownRenderer.render(
			this.app,
			text,
			temp,
			this.targetFile.path,
			component
		).then(() => {
			const item = temp.firstChild ?? temp;
			// remove margin and padding from the rendered element
			(item as HTMLElement).style.margin = "0";
			(item as HTMLElement).style.padding = "0";
			el.appendChild(item);
		});
	}

	override getSuggestions(query: string): FuzzyMatch<BlockCache>[] {
		const baseSuggestions = super.getSuggestions(query);
		return baseSuggestions.sort((a, b) => {
			const longestMatchLengthA = Math.max(...a.match.matches.map(x => x[1] - x[0]));
			const longestMatchLengthB = Math.max(...b.match.matches.map(x => x[1] - x[0]));
			if (longestMatchLengthA !== longestMatchLengthB) {
				return longestMatchLengthB - longestMatchLengthA;
			}
			const aText = this.getItemText(a.item);
			const bText = this.getItemText(b.item);
			return aText.localeCompare(bText);
		});
	}
}
