// src/BacklinkSearch/ChipsComponent.ts

import { TFile } from "obsidian";
import { FilePickerItem } from "./FilePickerModal";

export class ChipsComponent {

    private chipsEl: HTMLElement;
    private selectedFiles: FilePickerItem[] = [];

    constructor(
        parentEl: HTMLElement,
        private readonly onRemove: (file: FilePickerItem) => void
    ) {
        this.chipsEl = parentEl.createDiv({
            cls: "backlink-search-chips"
        });
    }

    setSelectedFiles(files: FilePickerItem[]): void {
        this.selectedFiles = files;
        this.render();
    }

    private render(): void {
        this.chipsEl.empty();

        for (const file of this.selectedFiles) {
            const chip = this.chipsEl.createDiv({
                cls: "backlink-search-chip"
            });
            chip.setText(file.alias);

            const closeBtn = chip.createSpan({
                cls: "backlink-search-chip-close"
            });
            closeBtn.setText("×");

            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.onRemove(file);
            };
        }
    }

    destroy(): void {
        this.chipsEl.remove();
    }

}
