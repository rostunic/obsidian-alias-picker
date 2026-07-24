import { PluginSettingTab, App, Setting } from 'obsidian';
import AliasPickerPlugin from './main';

export interface AliasPickerSettingsData {
	/**
	 * Whether to split the sidebar when opening the Alias Overview.
	 * Default: true
	 */
	overviewSplitSidebar: boolean;
}

export const DEFAULT_SETTINGS: AliasPickerSettingsData = {
	overviewSplitSidebar: true,
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
	}
}
