import { BlockCache, CachedMetadata, Editor, LinkCache, MarkdownFileInfo, Notice, Plugin, TFile, parseLinktext, WorkspaceLeaf } from 'obsidian';
import { AliasPicker } from './AliasPicker';
import { BlockPicker } from './BlockPicker';
import { AliasCache } from './AliasCache';
import { AliasRenameListener } from './AliasRenameListener';
import { PathPicker } from './PathPicker';
import { getKnownFileAliases, normalizeAliases } from './utilities';
import { AliasOverviewView } from './AliasOverviewView';
import { Settings, AliasPickerSettingsData, DEFAULT_SETTINGS } from './settings';
import { BacklinkSearchModal } from './BacklinkSearch/BacklinkSearchModal';

type Context = {

	editor: Editor,
	fileCache: CachedMetadata,
	currentLink: LinkCache,
	file: TFile,

}

export default class AliasPickerPlugin extends Plugin {
	private aliasCache: AliasCache = new AliasCache();
	private aliasRenameListener: AliasRenameListener = new AliasRenameListener(this.app, this.aliasCache);
	private settings: AliasPickerSettingsData = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new Settings(this.app, this));
		this.registerView(AliasOverviewView.Type, (leaf) => new AliasOverviewView(leaf, this.aliasCache));

		this.aliasRenameListener.startListening();
		this.addCommand({
			id: 'open-alias-overview',
			name: 'Open Alias Overview',
			callback: () => {
				this.app.workspace.rightSplit.expand();

				if (!this.settings.overviewOpenNewLeaf) {
					// Check if Alias Overview is already open in any leaf
					const existingLeaf = this.findAliasOverviewLeaf();
					if (existingLeaf) {
						// Reuse existing leaf
						existingLeaf.setViewState({
							type: AliasOverviewView.Type,
							active: true,
						});
						return;
					}
				}

				// Create new leaf with or without split based on settings
				const split = this.settings.overviewSplitSidebar;
				const newLeaf = this.app.workspace.getRightLeaf(split);
				if (!newLeaf) {
					console.error('Failed to create new leaf for Alias Overview');
					return;
				}
				newLeaf?.setViewState({
					type: AliasOverviewView.Type,
					active: true,
				});
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

				let allowedNames = [...new Set([...aliases, context.file.basename])];
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
					this.pickBlock(context, allowedBlocks);
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
					const aliases = getKnownFileAliases(this.app, currentFile);

					this.app.fileManager.processFrontMatter(currentFile, async (frontmatter) => {
						const existingAliases: string[] = normalizeAliases(frontmatter?.aliases);
						const newAliases = Array.from(aliases).filter(x => !existingAliases.includes(x));
						if (newAliases.length === 0) {
							new Notice('No new aliases to add');
							return;
						}
						frontmatter.aliases = [...existingAliases, ...newAliases];
						new Notice(`Added aliases: ${newAliases.join(', ')}`);
					});
				}
				return true;
			}
		});

		this.addCommand({
			id: "open-backlink-search",
			name: "Open Backlink Search",
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	public getSettings(): AliasPickerSettingsData {
		return this.settings;
	}

	private findAliasOverviewLeaf(): WorkspaceLeaf | null {
		const leaves = this.app.workspace.getLeavesOfType(AliasOverviewView.Type);
		return leaves.length > 0 ? leaves[0] : null;
	}
}