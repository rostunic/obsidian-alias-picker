import { PluginSettingTab, App, SettingDefinitionItem } from 'obsidian';
import AliasPickerPlugin from './main';

export interface AliasPickerSettingsData {
	overviewSplitSidebar: boolean;
	overviewOpenNewLeaf: boolean;
	includeAliasesInBacklinkSearchResults: boolean;
	rememberLastFilteredFilesAndAliases: boolean;
	focusFirstBacklinkSearchResultOnOpen: boolean;
}

export const DEFAULT_SETTINGS: AliasPickerSettingsData = {
	overviewSplitSidebar: true,
	overviewOpenNewLeaf: false,
	includeAliasesInBacklinkSearchResults: false,
	rememberLastFilteredFilesAndAliases: false,
	focusFirstBacklinkSearchResultOnOpen: true,
};

export class Settings extends PluginSettingTab {
	public static readonly SettingId = 'alias-picker-settings';

	constructor(app: App, private plugin: AliasPickerPlugin) {
		super(app, plugin);
	}

	public getSettings() {
		return this.plugin.getSettings();
	}

	public async saveSettings(settings: AliasPickerSettingsData): Promise<void> {
		await this.plugin.saveData(settings);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Split sidebar for alias overview',
				desc: 'Whether to split the right sidebar when opening the alias overview view.',
				control: {type: 'toggle', key: 'overviewSplitSidebar',}
			},
			{
				name: 'Open new leaf for alias overview',
				desc: 'Whether to open a new leaf even when the alias overview is already open.',
				control: {type: 'toggle', key: 'overviewOpenNewLeaf',}
			},
			{
				name: 'Include aliases in backlink search results',
				desc: 'Whether to include aliases in the backlink search results.',
				control: {type: 'toggle', key: 'includeAliasesInBacklinkSearchResults',}
			},
			{
				name: 'Remember last filtered files and aliases in backlink search',
				desc: 'Whether to remember the last filtered files and aliases in the backlink search modal.',
				control: {type: 'toggle', key: 'rememberLastFilteredFilesAndAliases',}
			},
			{
				name: 'Focus first backlink search result on open',
				desc: 'Whether to focus the first backlink, when opening a file using the backlink search modal.',
				control: {type: 'toggle', key: 'focusFirstBacklinkSearchResultOnOpen',}
			}
		];
	}
}
