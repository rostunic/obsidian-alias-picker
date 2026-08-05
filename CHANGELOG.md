# Changelog
# [1.0.10] - 2026-08-05
### Added
- Migrated to new Obsidian plugin API for settings, enabling better integration with Obsidian's new plugin settings tab.
### Fixed
- Fixed an issue where renaming an alias in the frontmatter did not update backlinks if the alias was not already present in the frontmatter. Now, if the alias is not found in the frontmatter, it will be added and all backlinks will be updated accordingly.
- Fixed warning obsidian review warnings


## [1.0.9] - 2026-08-04
### Added
- New context menu item in Alias Overview:  **Open in Backlink Search as exact alias**: Opens the Backlink Search modal with the selected alias as an exact match, allowing you to find all files that reference this alias and filter the results further. 


## [1.0.8] - 2026-08-04

### Added
- **Focus first backlink search result on open**: When opening a file from the backlink search modal, the cursor is now automatically positioned at the first backlink match. This setting can be toggled in the plugin settings (default: true).

## [1.0.7] - 2026-08-03

### Added
New: Context Menu in Alias Overview
Added a context menu to alias entries in the Alias Overview with the following actions:

- **Rename**: Rename an alias directly from the overview
- **Copy to Clipboard**: Copy the alias text to clipboard
- **Move Alias to Other File**: Move an alias from its current file to another file. This is useful, if you realize that an alias correspnds to another concept and should be moved to a different file. The backlinks to the alias will be updated automatically.

New Settings
- **Include Aliases in Backlink Search Results**: Controls whether aliases are included in backlink search results (default: false)
- **Remember last filtered files and aliases in backlink search**: Controls whether the last filtered files and aliases are remembered in the backlink search modal (default: false)

Changes
- Exact aliases are now removable in the backlink search chips
- Improved styling for exact aliases
- File picker in backlink search now displays aliases as subtext for better context
- Chips now display the alias name instead of just the filename

## [1.0.6] - 2026-07-29

### Added

- Open Backlink Search command.
  - Search for files containing backlinks to selected files or aliases.
  - Use `+File` to include backlinks to a file.
  - Use `-File` to exclude backlinks to a file.
  - Multiple `+` selections are combined using intersection.
  - Supports filenames and aliases.
  - Added fuzzy file picker for selecting references.
  - Selected references are displayed as removable chips.
  - Copy search results as Markdown links with `Ctrl/Cmd + C`.
  - Open selected files with `Enter`.

## [1.0.5] - 2026-07-24

### Added

- Added settings for Alias Overview:
  - Split Sidebar for Alias Overview.
  - Open New Leaf for Alias Overview.

### Changed

- Plugin settings are now handled through Obsidian's native plugin settings tab.
- Alias Overview reuses an already open view instead of creating duplicates.
- Sidebar split behavior can now be configured.

## [1.0.4] - 2026-07-20

### Changed

- Opening Alias Overview now expands the right sidebar automatically.

## [1.0.3] - 2026-06-23

### Added

- Open Alias Overview command.
  - Shows all aliases in the vault.
  - Shows where each alias is used.

### Changed

- Renaming an alias now automatically updates all occurrences of that alias throughout the vault.

## [1.0.2] - 2026-04-11

### Fixed

- Fixed plugin conventions to better align with Obsidian plugin requirements.

## [1.0.1] - 2026-04-06

### Added

- Pick alias.
- Pick block.