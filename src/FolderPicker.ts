import { FuzzySuggestModal, TFolder, App } from 'obsidian';

export class FolderPicker extends FuzzySuggestModal<TFolder> {
	constructor(app: App, private folders: TFolder[], private onChoose: (folder: TFolder) => void) {
		super(app);
	}
	getItems(): TFolder[] {
		return this.folders;
	}
	getItemText(item: TFolder): string {
		return item.path;
	}
	onChooseItem(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(item);
	}
}
