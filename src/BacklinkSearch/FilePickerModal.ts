// src/BacklinkSearch/FilePickerModal.ts

import {
    App,
    FuzzySuggestModal,
    FuzzyMatch,
    TFile
} from "obsidian";

import { AliasEntry, getAliasesForFile } from "./AliasUtils";

export interface FilePickerItem {
    file: TFile;
    displayText: string;
    alias: string;
}

export class FilePickerModal extends FuzzySuggestModal<FilePickerItem> {

    private readonly items: FilePickerItem[];

    constructor(
        app: App,
        files: AliasEntry[],
        private readonly callback: (filePickerItem: FilePickerItem) => void
    ) {
        super(app);
        // Jede Datei mit ihrem Dateinamen und allen Aliases als separate Einträge
        this.items = [];
        for (const file of files) {
            // Dateiname als Eintrag
            this.items.push({
                file: file.file,
                displayText: file.alias,
                alias: file.alias
            });
        }
    }

    getItems(): FilePickerItem[] {
        return this.items;
    }

    getItemText(item: FilePickerItem): string {
        // Beide Texte zurückgeben für korrekte Fuzzy-Suche
        return `${item.displayText} (${item.file.basename})`;
    }

    renderSuggestion(
        match: FuzzyMatch<FilePickerItem>,
        el: HTMLElement
    ): void {
        const item = match.item;

        // Anzeige-Text (Alias oder Dateiname)
        el.createDiv({
            text: item.displayText
        });

        // Dateiname in Klammern als Untertext
        el.createDiv({
            cls: "search-suggestion-subtext",
            text: `(${item.file.basename})`
        });
    }

    onChooseItem(item: FilePickerItem): void {
        this.callback(item);
    }

}
