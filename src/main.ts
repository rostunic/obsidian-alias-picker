import { App, BlockCache, CachedMetadata, Editor, LinkCache, MarkdownFileInfo, Notice, Plugin, TAbstractFile, TFile, TFolder, parseLinktext } from 'obsidian';
import { AliasPicker } from './AliasPicker';
import { BlockPicker } from './BlockPicker';
import { AliasCache } from './AliasCache';
import { AliasRenameListener } from './AliasRenameListener';
import { PathPicker } from './PathPicker';
import { getKnownAliasesOfAllFiles, getKnownFileAliases, getParentFolders, normalizeAliases } from './utilities';
import { AliasOverviewView } from './AliasOverviewView';
import { Settings, AliasPickerSettingsData, DEFAULT_SETTINGS } from './settings';
import { BacklinkSearchModal } from './BacklinkSearch/BacklinkSearchModal';
import { ObsidianFrontmatter } from './obsidian';
import { FolderPicker } from './FolderPicker';

type Context = {

	editor: Editor,
	fileCache: CachedMetadata,
	currentLink: LinkCache,
	file: TFile,

}

export default class AliasPickerPlugin extends Plugin {
	private aliasCache: AliasCache = new AliasCache();
	private aliasRenameListener: AliasRenameListener = new AliasRenameListener(this.app, this.aliasCache);
	public settings: AliasPickerSettingsData = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new Settings(this.app, this));
		this.registerView(AliasOverviewView.Type, (leaf) => new AliasOverviewView(leaf, this.aliasCache, this));

		this.aliasRenameListener.startListening();
		this.addCommand({
			id: 'open-alias-overview',
			name: 'Open alias overview',
			callback: () => {
				void AliasOverviewView.openAliasOverview(this.app, this.settings);
			}
		});

		this.addCommand({
			id: 'pick-alias',
			name: 'Pick alias',
			editorCheckCallback: (checking: boolean, editor: Editor, markdownFileInfo: MarkdownFileInfo) => {
				const context = this.getSelectedLinkAndContext(editor, markdownFileInfo);
				if (!context) return;

				if (!context.fileCache?.frontmatter) return;
				const aliases: string[] = normalizeAliases(context.fileCache.frontmatter.aliases);
				if (aliases.length === 0) return;

				const baseNameAliases = this.settings.interpretFileNameAsAlias ? [context.file.basename] : [];
				let allowedNames = [...new Set([...aliases, ...baseNameAliases])];
				if (context.currentLink.displayText) {
					allowedNames = allowedNames.filter(x => x !== context.currentLink.displayText);
				}
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
			id: 'pick-file-with-same-alias',
			name: 'Pick file with same alias',
			editorCheckCallback: (checking: boolean, editor: Editor, markdownFileInfo: MarkdownFileInfo) => {
				const context = this.getSelectedLinkAndContext(editor, markdownFileInfo);
				if (!context) return;

				const filePathsWithSameAlias = this.aliasCache.getFilesWithAlias(context.currentLink.displayText ?? '');
				if (filePathsWithSameAlias.every(path => path === context.file.path)) return;
				const allTargetFiles = filePathsWithSameAlias.map(path => this.app.vault.getFileByPath(path)).filter((file): file is TFile => file !== null);

				const targetFiles = allTargetFiles.filter(file => file.path !== context.file.path);
				if (targetFiles.length === 0) return;

				if (!checking) {
					const aliasPicker = new PathPicker(this.app, targetFiles, context.currentLink, context.editor);
					aliasPicker.open();
				}

				return true;
			}
		});
		this.addCommand({
			id: 'pick-block',
			name: 'Pick block',
			editorCheckCallback: (checking: boolean, editor: Editor, activeFileInfo: MarkdownFileInfo) => {
				const context = this.getSelectedLinkAndContext(editor, activeFileInfo);
				if (!context) return;

				const blocks = context.fileCache.blocks;
				if (!blocks) return;

				if (!checking) {
					const allowedBlocks = Object.values(blocks);
					if (allowedBlocks.length === 0) return;
					void this.pickBlock(context, allowedBlocks);
				}

				return true;
			}
		});

		this.addCommand({
			id: 'fill-known-aliases',
			name: 'Add all known aliases to the current file',
			editorCheckCallback: (checking: boolean, editor: Editor, activeFileInfo: MarkdownFileInfo) => {
				const currentFile = activeFileInfo.file;
				if (!currentFile || !editor) return;
				if (!checking) {
					const addAliases = async () => {
						const added = await addAllAliasesToFile(this.app, currentFile, this.settings);
						logAddedAliases(added, currentFile);
					};
					void addAliases();
				}
				return true;
			}
		});

		this.addCommand({
			id: 'fill-known-aliases-vault',
			name: 'Add all known aliases to all files in the vault',
			checkCallback: (checking: boolean) => {
				if (!checking) {
					const allFiles = this.app.vault.getMarkdownFiles();
					const folderIdentifier = `the vault`;
					const app = this.app;
					const settings = this.settings;
					void addKnownAliasesToFiles(allFiles, folderIdentifier, app, settings);
				}
				return true;
			}
		});
		this.addCommand({
			id: 'fill-known-aliases-folder',
			name: 'Add all known aliases to all files in the current folder',
			editorCheckCallback: (checking: boolean, editor: Editor, activeFileInfo: MarkdownFileInfo) => {
				const activeFile = activeFileInfo.file;
				if (!activeFile) return;
				const parentFolders = getParentFolders(activeFile);
				if (parentFolders.length === 0) return;
				if (!checking) {
					const picker = new FolderPicker(this.app, parentFolders, (folder) => {
						function getFiles(child: TAbstractFile): TFile[] {
							if (child instanceof TFile && child.extension === 'md')
								return [child];
							if (child instanceof TFolder)
								return child.children.flatMap(getFiles);
							return [];
						}
						const allFiles = folder.children.flatMap(getFiles);
						void addKnownAliasesToFiles(allFiles, folder.name, this.app, this.settings);
					});
					picker.open();
				}
				return true;
			}
		})

		this.addCommand({
			id: "open-backlink-search",
			name: "Open backlink search",
			callback: () => {
				new BacklinkSearchModal(
					this.app,
					this.settings
				).open();
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

	getSelectedLinkAndContext(editor: Editor, activeFileInfo: MarkdownFileInfo): Context | undefined {
		const currentFile = activeFileInfo.file;
		if (!currentFile || !editor) return;
		const currentCache = this.app.metadataCache.getFileCache(currentFile);
		const links = currentCache?.links;
		if (!links) return;
		const cursorOffset = editor.posToOffset(editor.getCursor());
		const currentLink = links.find(x => x.position.start.offset <= cursorOffset && x.position.end.offset >= cursorOffset)
		if (!currentLink) return;
		const parsedLink = parseLinktext(currentLink.link);
		const file = this.app.vault.getFileByPath(parsedLink.path)
			?? this.app.metadataCache.getFirstLinkpathDest(parsedLink.path, '');
		if (!file) return;

		const fileCache = this.app.metadataCache.getFileCache(file);
		if (!fileCache) return;

		return {
			editor,
			fileCache,
			currentLink,
			file,
		};
	}

	onunload() {
		this.aliasRenameListener.stopListening();
	}

	private async loadSettings(): Promise<void> {
		const loadedData = await this.loadData() as AliasPickerSettingsData | null;
		this.settings = { ...DEFAULT_SETTINGS, ...loadedData };
	}

	public getSettings(): AliasPickerSettingsData {
		return this.settings;
	}
}
async function addKnownAliasesToFiles(allFiles: TFile[], folderIdentifier: string, app: App, settings: AliasPickerSettingsData) {
	const notice = new Notice(`Adding all known aliases to all ${allFiles.length} files in ${folderIdentifier}. This may take a while...`, 0);
	let i = 0;
	let addedCounter = 0;
	let fileAddedCounter = 0;
	const allKnownAliases = getKnownAliasesOfAllFiles(app, settings.interpretFileNameAsAlias);
	for (const file of allFiles) {
		i++;
		notice.setMessage(`Adding all known aliases to file ${i}/${allFiles.length} of ${folderIdentifier}. Processing file ${i}/${allFiles.length}: ${file.path}`);
		const added = await addAllAliasesToFile(app, file, settings, allKnownAliases);
		addedCounter += added.length;
		fileAddedCounter += added.length > 0 ? 1 : 0;

		// Alle 10 Dateien den Main Thread freigeben
		if (i % 10 === 0) {
			await new Promise<void>(resolve => window.setTimeout(resolve, 0));
		}
	}
	notice.setMessage(`Finished adding all known aliases to all ${allFiles.length} files in ${folderIdentifier}. Added a total of ${addedCounter} aliases to ${fileAddedCounter} files.`);
	window.setTimeout(() => notice.hide(), 3000);
}

async function addAllAliasesToFile(app: App, file: TFile, settings: AliasPickerSettingsData, allKnownAliases: Map<string, Set<string>> | undefined = undefined): Promise<string[]> {
	const aliases = getKnownFileAliases(app, file, settings.interpretFileNameAsAlias, allKnownAliases);

	let addedAliases: string[] = [];

	try {
		await app.fileManager.processFrontMatter(file, (frontmatter: ObsidianFrontmatter) => {
			const existingAliases: string[] = normalizeAliases(frontmatter?.aliases);
			const newAliases = Array.from(aliases).filter(x => !existingAliases.includes(x));
			if (newAliases.length === 0) {
				return;
			}
			frontmatter.aliases = [...existingAliases, ...newAliases];
			addedAliases = newAliases;
		});
	} catch (e) {
		if (e instanceof Error) {
			new Notice(`Error adding aliases to file ${file.path}: ${e.message}`);
		}
		return [];
	}
	return addedAliases;
}
function logAddedAliases(addedAliases: string[], file: TFile, notice: Notice | undefined = undefined, messagePrefix: string = '') {
	const mesage = messagePrefix + (addedAliases.length > 0
		? `Added aliases: ${addedAliases.join(', ')} to file ${file.path}`
		: `No new aliases to add to file ${file.path}`);
	if (notice) {
		notice.setMessage(mesage);
	}
	else {
		new Notice(mesage);
	}
}