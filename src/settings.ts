import { PluginSettingTab, App, Setting } from 'obsidian';
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

	public async getSettings(): Promise<AliasPickerSettingsData> {
		return this.plugin.getSettings();
	}

	public async saveSettings(settings: AliasPickerSettingsData): Promise<void> {
		await this.plugin.saveData(settings);
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Alias Picker Settings' });

		new Setting(containerEl)
			.setName('Split Sidebar for Alias Overview')
			.setDesc('Whether to split the right sidebar when opening the Alias Overview view.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.getSettings().overviewSplitSidebar)
					.onChange(async (value) => {
						const currentSettings = this.plugin.getSettings();
						currentSettings.overviewSplitSidebar = value;
						await this.saveSettings(currentSettings);
					})
			);

		new Setting(containerEl)
			.setName('Open New Leaf for Alias Overview')
			.setDesc('Whether to open a new leaf even when the Alias Overview is already open.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.getSettings().overviewOpenNewLeaf)
					.onChange(async (value) => {
						const currentSettings = this.plugin.getSettings();
						currentSettings.overviewOpenNewLeaf = value;
						await this.saveSettings(currentSettings);
					})
			);

		new Setting(containerEl)
			.setName('Include Aliases in Backlink Search Results')
			.setDesc('Whether to include aliases in the backlink search results.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.getSettings().includeAliasesInBacklinkSearchResults)
					.onChange(async (value) => {
						const currentSettings = this.plugin.getSettings();
						currentSettings.includeAliasesInBacklinkSearchResults = value;
						await this.saveSettings(currentSettings);
					})
			);
		
		new Setting(containerEl)
			.setName('Remember last filtered files and aliases in backlink search')
			.setDesc('Whether to remember the last filtered files and aliases in the backlink search modal.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.getSettings().rememberLastFilteredFilesAndAliases)
					.onChange(async (value) => {
						const currentSettings = this.plugin.getSettings();
						currentSettings.rememberLastFilteredFilesAndAliases = value;
						await this.saveSettings(currentSettings);
					})
			);

		new Setting(containerEl)
			.setName('Focus first backlink search result on open')
			.setDesc('Whether to focus the first backlink, when opening a file using the backlink search modal.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.getSettings().focusFirstBacklinkSearchResultOnOpen)
					.onChange(async (value) => {
						const currentSettings = this.plugin.getSettings();
						currentSettings.focusFirstBacklinkSearchResultOnOpen = value;
						await this.saveSettings(currentSettings);
					})
			);
	}
}
