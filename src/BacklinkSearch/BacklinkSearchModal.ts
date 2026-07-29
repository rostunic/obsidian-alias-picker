// src/BacklinkSearch/BacklinkSearchModal.ts

import {
    App,
    FuzzySuggestModal,
    FuzzyMatch,
    TFile,
    Notice,
    Platform
} from "obsidian";

import { BacklinkEngine } from "./BacklinkEngine";
import { FilePickerModal } from "./FilePickerModal";
import { ChipsComponent } from "./ChipsComponent";
import { getAliasesForFile } from "./AliasUtils";

interface SearchItem {
    type: "file" | "alias";
    file: TFile;
    alias?: string;
}

export class BacklinkSearchModal extends FuzzySuggestModal<SearchItem> {

    private readonly engine: BacklinkEngine;
    private selectedFiles: TFile[] = [];
    private excludedBacklinksFiles: TFile[] = [];
    private items: SearchItem[] = [];
    private chipsComponent: ChipsComponent;
    private excludedChipsComponent: ChipsComponent;

    constructor(
        app: App
    ) {
        super(app);

        this.engine = new BacklinkEngine(app);

        this.setPlaceholder("Search common backlink files. Type '+', '-', or search by alias or filename.");

        const inputContainer = this.inputEl.parentElement?.parentElement;
        //class prompt-resuls
        const promptResults = inputContainer?.querySelector(".prompt-results") as HTMLElement | null;
        if (!inputContainer || !promptResults) {
            throw new Error("Could not find input container or prompt results element.");
        }

        this.chipsComponent = this.createChipsContainer(inputContainer, promptResults);
        this.excludedChipsComponent = this.createExcludedChipsComponent(inputContainer, promptResults);

        this.setInstructions([
            {
                command: "Type +X",
                purpose: "The search will include only files that reference file X"
            },
            {
                command: "Type -X",
                purpose: "The search will not include file X"
            },
            {
                command: "Ctrl/Cmd + C",
                purpose: "Copy the list of backlink files to clipboard"
            }
        ]);
    }

    async onOpen(): Promise<void> {
        super.onOpen();

        this.inputEl.addEventListener(
            "input",
            () => {
                void this.handleInput();
            }
        );

        this.inputEl.addEventListener(
            "keydown",
            async (e) => {
                if (
                    (Platform.isMacOS ? e.metaKey : e.ctrlKey) &&
                    e.key === "c"
                ) {
                    e.preventDefault();
                    await this.copyResultsToClipboard();
                }
            }
        );
    }

    private createChipsContainer(inputContainer: HTMLElement, promptResults: HTMLElement) {
        const chipsContainer = inputContainer.createDiv({
            cls: "backlink-search-chips-container"
        });
        inputContainer.insertBefore(chipsContainer, promptResults);

        return new ChipsComponent(
            chipsContainer,
            (file) => this.removeSelectedFile(file)
        );
    }

    private createExcludedChipsComponent(inputContainer: HTMLElement, promptResults: HTMLElement) {
        const excludedChipsContainer = inputContainer.createDiv({
            cls: "backlink-search-chips-container backlink-search-chips-excluded"
        });
        inputContainer.insertBefore(excludedChipsContainer, promptResults);

        return new ChipsComponent(
            excludedChipsContainer,
            (file) => this.removeExcludedFile(file)
        );
    }

    async onClose(): Promise<void> {
        super.onClose();
    }

    private async handleInput(): Promise<void> {
        if (this.inputEl.value.startsWith("+")) {
            this.inputEl.value = "";

            // Alle aktuellen included und excluded Files berücksichtigen
            const files = await this.engine.getPlusCandidates(
                this.selectedFiles,
                this.excludedBacklinksFiles
            );

            this.openFilePickerAndRefresh(files, this.selectedFiles, this.chipsComponent, "Select a file to include in the backlink search");
        } else if (this.inputEl.value.startsWith("-")) {
            this.inputEl.value = "";

            // Alle aktuellen included und excluded Files berücksichtigen
            const files = await this.engine.getMinusCandidates(
                this.selectedFiles,
                this.excludedBacklinksFiles
            );

            this.openFilePickerAndRefresh(files, this.excludedBacklinksFiles, this.excludedChipsComponent, "Select a file to exclude from the backlink search");
        }
    }

    private openFilePickerAndRefresh(
        files: TFile[],
        selectedFiles: TFile[],
        chipsComponent: ChipsComponent,
        placeholder: string
    ): void {
        const filePickerModal = new FilePickerModal(
            this.app,
            files,
            (file) => {
                selectedFiles.push(file);
                chipsComponent.setSelectedFiles(selectedFiles);
                void this.refresh();
            }
        )
        filePickerModal.setPlaceholder(placeholder);
        filePickerModal.open();
    }

    private async refresh(): Promise<void> {
        const files = await this.engine.getIntersection(this.selectedFiles);

        // Excluded Files ausschließen
        const filteredFiles = files.filter(
            file => !this.excludedBacklinksFiles.some(excluded => excluded.path === file.path)
        );

        this.items = this.filesToSearchItems(filteredFiles);

        // Refresh the suggestions in the modal
        super.onOpen();
        this.chipsComponent.setSelectedFiles(this.selectedFiles);
        this.excludedChipsComponent.setSelectedFiles(this.excludedBacklinksFiles);
    }

    private filesToSearchItems(files: TFile[]): SearchItem[] {
        const searchItems: SearchItem[] = [];

        for (const file of files) {
            searchItems.push({
                type: "file",
                file
            });

            const aliases = getAliasesForFile(this.app, file);
            for (const alias of aliases) {
                searchItems.push({
                    type: "alias",
                    file,
                    alias
                });
            }
        }
        return searchItems;
    }

    private removeSelectedFile(fileToRemove: TFile): void {
        this.selectedFiles = this.selectedFiles.filter(
            file => file.path !== fileToRemove.path
        );
        void this.refresh();
    }

    private removeExcludedFile(fileToRemove: TFile): void {
        this.excludedBacklinksFiles = this.excludedBacklinksFiles.filter(
            file => file.path !== fileToRemove.path
        );
        void this.refresh();
    }

    getItems(): SearchItem[] {
        return this.items;
    }

    getItemText(item: SearchItem): string {
        if (item.type === "alias" && item.alias) {
            return item.alias;
        }

        return [
            item.file.basename,
            item.file.path,
            ...getAliasesForFile(this.app, item.file)
        ]
            .filter(Boolean)
            .join(" ");
    }

    renderSuggestion(
        match: FuzzyMatch<SearchItem>,
        el: HTMLElement
    ): void {
        const item = match.item;

        if (item.type === "alias" && item.alias) {
            el.createDiv({
                text: item.alias
            });
            el.createDiv({
                cls: "search-suggestion-subtext",
                text: item.file.basename
            });
        } else {
            el.createDiv({
                text: item.file.basename
            });

            for (const alias of getAliasesForFile(this.app, item.file)) {
                el.createDiv({
                    cls: "search-suggestion-subtext",
                    text: alias
                });
            }
        }
    }

    onChooseItem(item: SearchItem): void {
        void this.app.workspace
            .getLeaf()
            .openFile(item.file);
    }

    private async copyResultsToClipboard(): Promise<void> {
        const files = this.items
            .filter(item => item.type === "file")
            .map(item => item.file);

        const uniqueFiles = Array.from(
            new Map(files.map(f => [f.path, f])).values()
        );

        const links = await Promise.all(
            uniqueFiles.map(async (file) => {
                const link = this.app.fileManager.generateMarkdownLink(
                    file,
                    this.app.workspace.getActiveFile()?.path ?? "",
                    "",
                    file.basename
                );
                return link;
            })
        );

        await navigator.clipboard.writeText(links.join("\n"));
        new Notice(`Copied: ${uniqueFiles.length} file(s)`);
    }

}
