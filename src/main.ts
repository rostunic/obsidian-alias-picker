import { BlockCache, CachedMetadata, Editor, LinkCache, MarkdownView, Plugin, TFile, parseLinktext } from 'obsidian';
import { AliasPicker } from './AliasPicker';
import { BlockPicker } from './BlockPicker';

type Context = {

	activeEditor: MarkdownView,
	editor: Editor,
	fileCache: CachedMetadata,
	currentLink: LinkCache,
	file: TFile,

}

export default class AliasPickerPlugin extends Plugin {

	async onload() {
		this.addCommand({
			id: 'alias-picker-pick-alias',
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
			id: 'alias-picker-pick-block',
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

	async pickBlock(context: Context, allowedBlocks: BlockCache[]) {
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