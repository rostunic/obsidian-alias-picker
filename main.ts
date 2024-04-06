import { App, BlockCache, CachedMetadata, Editor, EditorPosition, FuzzySuggestModal, LinkCache, Loc, MarkdownView, Plugin, TFile, parseLinktext } from 'obsidian';


class AliasPicker extends FuzzySuggestModal<string> {
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
		const start = LocToEditorPosition(this.link.position.start);
		const end = this.editor.offsetToPos(this.link.position.end.offset);
		const parsed = parseLinktext(this.link.original);
		const newLink = this.app.fileManager.generateMarkdownLink(this.targetFile, parsed.path, parsed.subpath.replace(/\)+$/, ''), item);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length + 1);
		this.editor.setCursor(newPosition);
	}
}
class BlockPicker extends FuzzySuggestModal<BlockCache> {
	getItems(): BlockCache[] {
		return this.Blocks;
	}
	getItemText(item: BlockCache): string {
		// const start = PosToEditorPosition(item.position.start);
		// const end = PosToEditorPosition(item.position.end);
		const text = this.targetFileContent.slice(item.position.start.offset, item.position.end.offset);
		return text;
	}
	onChooseItem(item: BlockCache, evt: MouseEvent | KeyboardEvent): void {
		this.chooseItem(item);
	}
	constructor(app: App, private targetFile: TFile, private targetFileContent : string, private link: LinkCache, private Blocks: BlockCache[],
		private editor: Editor
	) {
		super(app);
	}
	chooseItem(block: BlockCache) {
		const start = LocToEditorPosition(this.link.position.start);
		const end = LocToEditorPosition(this.link.position.end);
		const parsed = parseLinktext(this.link.original);
		const newLink = this.app.fileManager.generateMarkdownLink(this.targetFile, parsed.path, "#^" + block.id, this.link.displayText);
		this.editor.replaceRange(newLink, start, end);
		const newPosition = this.editor.offsetToPos(this.link.position.start.offset + newLink.length + 1);
		this.editor.setCursor(newPosition);
	}
}


export default class MyPlugin extends Plugin {

	async onload() {
		this.addCommand({
			id: 'opsidian-alias-picker-pick-alias',
			name: 'Pick alias',
			checkCallback: (checking: boolean) => {
				const context = this.getSelectedLinkAndContext();
				if (!context) return;

				if (!context.fileCache?.frontmatter) return;
				const aliases: string[] | undefined = context.fileCache.frontmatter.aliases;
				if (!aliases) return;

				const allowedNames = [...new Set([...aliases, context.file.basename])];
				if (context.currentLink.displayText)
					allowedNames.remove(context.currentLink.displayText)
				if (allowedNames.length === 0) return;

				if (!checking) {
					const aliasPicker = new AliasPicker(this.app, context.file, context.currentLink, allowedNames, context.editor);
					if (allowedNames.length === 1) {
						aliasPicker.chooseItem(allowedNames[0]);
						return;
					}
					aliasPicker.open();
				}

				return true;
			}
		});
		this.addCommand({
			id: 'opsidian-alias-picker-pick-block',
			name: 'Pick block',
			checkCallback: (checking: boolean) => {
				const context = this.getSelectedLinkAndContext();
				if (!context) return;

				const blocks = context.fileCache.blocks;
				if (!blocks) return;

				const allowedBlocks = Object.values(blocks);
				if (allowedBlocks.length === 0) return;

				if (!checking) {
					this.pickBlock(context, allowedBlocks);
				}

				return true;
			}
		});

	}

	async pickBlock(context:Context, allowedBlocks: BlockCache[] ) {
		const targetFileContent = await this.app.vault.read(context.file);
		const aliasPicker = new BlockPicker(this.app, context.file, targetFileContent, context.currentLink, allowedBlocks, context.editor);
		if (allowedBlocks.length === 1) {
			aliasPicker.chooseItem(allowedBlocks[0]);
			return;
		}
		aliasPicker.open();

	}

	getSelectedLinkAndContext(): Context | undefined {
		const activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeEditor) return;
		const editor = activeEditor?.editor;
		const currentFile = activeEditor.file;
		if (!currentFile || !editor) return;
		const currentCache = this.app.metadataCache.getFileCache(currentFile);
		const links = currentCache?.links;
		if (!links) return;
		const cursorOffset = editor.posToOffset(editor.getCursor());
		const currentLink = links.find(x => x.position.start.offset <= cursorOffset && x.position.end.offset >= cursorOffset)
		if (!currentLink) return;
		const parsedLink = parseLinktext(currentLink.link);
		const file = this.app.vault.getFileByPath(parsedLink.path)
			?? this.app.vault.getFiles().find(x => x.name == parsedLink.path);
		if (!file) return;

		const fileCache = this.app.metadataCache.getFileCache(file);
		if (!fileCache) return;

		return {
			activeEditor,
			editor,
			fileCache,
			currentLink,
			file,
		};
	}

	onunload() {

	}
}

function LocToEditorPosition(location: Loc): EditorPosition {
	return { line: location.line, ch: location.col }
}

type Context = {

	activeEditor: MarkdownView,
	editor: Editor,
	fileCache: CachedMetadata,
	currentLink: LinkCache,
	file: TFile,

}