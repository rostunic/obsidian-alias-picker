import { App, Editor,FuzzySuggestModal, LinkCache, MarkdownView, Modal, Plugin, TFile, parseLinktext } from 'obsidian';


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
		const start = this.editor.offsetToPos(this.link.position.start.offset);
		const end = this.editor.offsetToPos(this.link.position.end.offset);
		const parsed = parseLinktext(this.link.original);
		const newLink = this.app.fileManager.generateMarkdownLink(this.targetFile, parsed.path, parsed.subpath, item);
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
				const file = this.app.vault.getFileByPath(currentLink.link);
				if (!file) return;
				const fileCache = this.app.metadataCache.getFileCache(file);
				if (!fileCache?.frontmatter) return;
				const aliases: string[] | undefined = fileCache.frontmatter.aliases;
				if (!aliases) return;

				const allowedNames = [...aliases, file.basename];
				if (currentLink.displayText)
					allowedNames.remove(currentLink.displayText)
				if (allowedNames.length === 0) return;

				if (!checking) {
					const aliasPicker = new AliasPicker(this.app, file, currentLink, allowedNames, editor);
					if (allowedNames.length === 1) {
						aliasPicker.chooseItem(allowedNames[0]);
						return;
					}
					aliasPicker.open();
				}

				return true;
			}
		});
	}

	onunload() {

	}
}