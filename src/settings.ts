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

	public getSettings() {
		return this.plugin.getSettings();
	}

	public async saveSettings(settings: AliasPickerSettingsData): Promise<void> {
		await this.plugin.saveData(settings);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Split sidebar for alias overview')
			.setDesc('Whether to split the right sidebar when opening the alias overview view.')
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
			.setName('Open new leaf for alias overview')
			.setDesc('Whether to open a new leaf even when the alias overview is already open.')
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
			.setName('Include aliases in backlink search results')
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
