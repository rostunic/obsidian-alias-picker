// src/BacklinkSearch/BacklinkSearchModal.ts

import {
    App,
    FuzzySuggestModal,
    FuzzyMatch,
    TFile,
    Notice,
    Platform,
    MarkdownView
} from "obsidian";

import { BacklinkEngine } from "./BacklinkEngine";
import { FilePickerItem, FilePickerModal } from "./FilePickerModal";
import { ChipsComponent } from "./ChipsComponent";
import { AliasEntry, getAliasesForFile } from "./AliasUtils";
import { AliasPickerSettingsData } from "../settings";

interface SearchItem {
    type: "file" | "alias";
    file: TFile;
    alias?: string;
}



export class BacklinkSearchModal extends FuzzySuggestModal<SearchItem> {

    private static lastSelectedFiles: FilePickerItem[] = [];
    private static lastExactBacklinksFileAliases: FilePickerItem[] = [];
    private static lastExcludedBacklinksFiles: FilePickerItem[] = [];

    private readonly engine: BacklinkEngine;
    private selectedFiles: FilePickerItem[];
    private exactBacklinksFileAliases: FilePickerItem[];
    private excludedBacklinksFiles: FilePickerItem[];
    private items: SearchItem[] = [];
    private includedFilesChipsComponent: ChipsComponent;
    private exactChipsComponent: ChipsComponent;
    private excludedChipsComponent: ChipsComponent;

    constructor(
        app: App,
        private readonly settings: AliasPickerSettingsData,
        exactBacklinksFileAliases?: FilePickerItem[],
        selectedFiles?: FilePickerItem[],
    ) {
        super(app);
        const useLastState = !exactBacklinksFileAliases && !selectedFiles && this.settings.rememberLastFilteredFilesAndAliases;
        this.excludedBacklinksFiles = useLastState ? BacklinkSearchModal.lastExcludedBacklinksFiles : [];
        this.exactBacklinksFileAliases = exactBacklinksFileAliases ?? (useLastState ? BacklinkSearchModal.lastExactBacklinksFileAliases : []);
        this.selectedFiles = selectedFiles ?? (useLastState ? BacklinkSearchModal.lastSelectedFiles : []);

        this.engine = new BacklinkEngine(app);

        this.setPlaceholder("Search common backlink files. Type '+', '*', or '-', or search by alias or filename.");

        const inputContainer = this.inputEl.parentElement?.parentElement;
        //class prompt-resuls
        const promptResults = inputContainer?.querySelector(".prompt-results") as HTMLElement | null;
        if (!inputContainer || !promptResults) {
            throw new Error("Could not find input container or prompt results element.");
        }

        this.includedFilesChipsComponent = this.createChipsContainer(inputContainer, promptResults, "Referenced Files");
        this.exactChipsComponent = this.createExactAliasChipsContainer(inputContainer, promptResults, "Referenced Aliases");
        this.excludedChipsComponent = this.createExcludedChipsComponent(inputContainer, promptResults, "Excluded Backlink Files");

        this.setInstructions([
            {
                command: "Type +X",
                purpose: "The search will include only files that reference file X"
            },
            {
                command: "Type *X",
                purpose: "Like +X, except that the exact alias has to be used in the backlink."
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
        this.refresh();
    }

    private createChipsContainer(inputContainer: HTMLElement, promptResults: HTMLElement, name: string) {
        const chipsContainer = inputContainer.createDiv({
            cls: "backlink-search-chips-container"
        });
        chipsContainer.createDiv({
            cls: "backlink-search-chips-title",
            text: `${name}:`
        });
        inputContainer.insertBefore(chipsContainer, promptResults);

        return new ChipsComponent(
            chipsContainer,
            (file) => this.removeSelectedFile(file)
        );
    }

    private createExactAliasChipsContainer(inputContainer: HTMLElement, promptResults: HTMLElement, name: string) {
        const chipsContainer = inputContainer.createDiv({
            cls: "backlink-search-chips-container"
        });
        chipsContainer.createDiv({
            cls: "backlink-search-chips-title",
            text: `${name}:`
        });
        inputContainer.insertBefore(chipsContainer, promptResults);

        return new ChipsComponent(
            chipsContainer,
            (file) => this.removeExactAlias(file)
        );
    }

    private createExcludedChipsComponent(inputContainer: HTMLElement, promptResults: HTMLElement, name: string) {
        const excludedChipsContainer = inputContainer.createDiv({
            cls: "backlink-search-chips-container backlink-search-chips-excluded"
        });
        excludedChipsContainer.createDiv({
            cls: "backlink-search-chips-title",
            text: `${name}:`
        });
        inputContainer.insertBefore(excludedChipsContainer, promptResults);

        return new ChipsComponent(
            excludedChipsContainer,
            (file) => this.removeExcludedFile(file)
        );
    }

    async onClose(): Promise<void> {
        BacklinkSearchModal.lastSelectedFiles = this.selectedFiles;
        BacklinkSearchModal.lastExactBacklinksFileAliases = this.exactBacklinksFileAliases;
        BacklinkSearchModal.lastExcludedBacklinksFiles = this.excludedBacklinksFiles;
        super.onClose();
    }

    private async handleInput(): Promise<void> {
        if (this.inputEl.value.startsWith("+")) {
            this.inputEl.value = "";

            // Alle aktuellen included und excluded Files berücksichtigen
            const files = await this.engine.getPlusCandidates(
                this.selectedFiles.map(fileItem => fileItem.file),
                this.exactBacklinksFileAliases,
                this.excludedBacklinksFiles.map(fileItem => fileItem.file),
                true
            );

            this.openFilePickerAndRefresh(files, this.selectedFiles, this.includedFilesChipsComponent, "Select a file to include in the backlink search");
        } else if (this.inputEl.value.startsWith("*")) {
            this.inputEl.value = "";

            // Alle aktuellen included und excluded Files berücksichtigen
            const files = await this.engine.getPlusCandidates(
                this.selectedFiles.map(fileItem => fileItem.file),
                this.exactBacklinksFileAliases,
                this.excludedBacklinksFiles.map(fileItem => fileItem.file),
                false
            );

            this.openFilePickerAndRefresh(files, this.exactBacklinksFileAliases, this.exactChipsComponent, "Select an file alias to include in the backlink search");
        } else if (this.inputEl.value.startsWith("-")) {
            this.inputEl.value = "";

            // Alle aktuellen included und excluded Files berücksichtigen
            const files = await this.engine.getMinusCandidates(
                this.selectedFiles.map(fileItem => fileItem.file),
                this.exactBacklinksFileAliases,
                this.excludedBacklinksFiles.map(fileItem => fileItem.file)
            );

            this.openFilePickerAndRefresh(files, this.excludedBacklinksFiles, this.excludedChipsComponent, "Select a file to exclude from the backlink search");
        }
    }

    private openFilePickerAndRefresh(
        files: AliasEntry[],
        selectedFiles: FilePickerItem[],
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
        const files = await this.engine.getIntersection(this.selectedFiles.map(fileItem => fileItem.file), this.exactBacklinksFileAliases);

        // Excluded Files ausschließen
        const filteredFiles = files.filter(
            file => !this.excludedBacklinksFiles.some(excluded => excluded.file.path === file.path)
        );

        this.items = this.filesToSearchItems(filteredFiles);

        // Refresh the suggestions in the modal
        super.onOpen();
        this.includedFilesChipsComponent.setSelectedFiles(this.selectedFiles);
        this.exactChipsComponent.setSelectedFiles(this.exactBacklinksFileAliases);
        this.excludedChipsComponent.setSelectedFiles(this.excludedBacklinksFiles);
    }

    private filesToSearchItems(files: TFile[]): SearchItem[] {
        const searchItems: SearchItem[] = [];

        for (const file of files) {
            searchItems.push({
                type: "file",
                file
            });
            if (this.settings.includeAliasesInBacklinkSearchResults) {
                const aliases = getAliasesForFile(this.app, file, true);
                for (const alias of aliases) {
                    searchItems.push({
                        type: "alias",
                        file,
                        alias
                    });
                }
            }
        }
        return searchItems;
    }

    private removeSelectedFile(fileToRemove: FilePickerItem): void {
        this.selectedFiles = this.selectedFiles.filter(
            fileItem => fileItem.file.path !== fileToRemove.file.path
        );
        void this.refresh();
    }

    private removeExactAlias(fileToRemove: FilePickerItem): void {
        this.exactBacklinksFileAliases = this.exactBacklinksFileAliases.filter(
            fileItem => fileItem.file.path !== fileToRemove.file.path || fileItem.alias !== fileToRemove.alias
        );
        void this.refresh();
    }

    private removeExcludedFile(fileToRemove: FilePickerItem): void {
        this.excludedBacklinksFiles = this.excludedBacklinksFiles.filter(
            fileItem => fileItem.file.path !== fileToRemove.file.path
        );
        void this.refresh();
    }

    getItems(): SearchItem[] {
        return this.items;
    }

    getItemText(item: SearchItem): string {
        if (item.type === "alias" && item.alias) {
            return item.alias + " (" + item.file.basename + ")";
        }

        let text = item.file.basename;
        if (item.file.path !== item.file.basename) {
            text += ` (${item.file.path})`;
        }
        if (!this.settings.includeAliasesInBacklinkSearchResults) {
            const aliases = getAliasesForFile(this.app, item.file, true);
            text += aliases.length > 0 ? ` [${aliases.join(", ")}]` : "";
        }
        return text;
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
            if (!this.settings.includeAliasesInBacklinkSearchResults) {
                for (const alias of getAliasesForFile(this.app, item.file, true)) {
                    el.createDiv({
                        cls: "search-suggestion-subtext",
                        text: alias
                    });
                }
            }
        }
    }

    async onChooseItem(item: SearchItem): Promise<void> {
        const openTask = this.app.workspace
            .getLeaf()
            .openFile(item.file);
        if (this.settings.focusFirstBacklinkSearchResultOnOpen) {
            await openTask;
            const openedFile = item.file;
            const outgoingLinks = this.app.metadataCache.getFileCache(openedFile)?.links ?? [];
            // find first match in this.selectedFiles or this.exactBacklinksFileAliases
            const firstMatch = outgoingLinks.find(link => {
                const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, openedFile.path);
                return this.exactBacklinksFileAliases.some(
                    fileItem => linkedFile?.path === fileItem.file.path && link.displayText === fileItem.alias)
                    || this.selectedFiles.some(fileItem => linkedFile?.path === fileItem.file.path);
            }
            );
            // if found, focus the first match
            if (firstMatch) {
                const leaf = this.app.workspace.getLeaf(false);
                // set focus at link position in the opened file
                // const editor = leaf.view.sourceMode.cmEditor; // Property 'sourceMode' does not exist on type 'View'.
                if (leaf.view instanceof MarkdownView) {
                    const editor = leaf.view.editor;
                    editor.setCursor({ line: firstMatch.position.start.line, ch: firstMatch.position.start.col });
                    editor.scrollIntoView({ from: { line: firstMatch.position.start.line, ch: firstMatch.position.start.col }, to: { line: firstMatch.position.end.line, ch: firstMatch.position.end.col } }, true);
                }
            }
        }
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
