# Alias Picker

The Alias Picker plugin for Obsidian introduces two commands: 'Pick alias' and 'Pick block'.
These commands simplify the process of modifying wiki or Markdown links within your notes.

For a complete changelog, see the [CHANGELOG.md](CHANGELOG.md).

## Features:
- **Pick alias**: Easily select an alternative alias for the current link from the available aliases for the file.
- **Pick block**: Modify the referenced block within the file using the '#^BlockIdentifier' syntax.
- **Automatic alias renaming**: When renaming an alias, the plugin automatically updates all instances of that alias throughout your vault.
- **Alias Overview**: Use the "Open Alias Overview" command to view all aliases in your vault and see the usages of each alias.

## How to use:
With the cursor on the link, execute the 'Pick alias' or 'Pick block' command from the plugin menu or via keyboard shortcuts.
Choose from the available blocks or aliases to make your desired changes.

You should assign a keyboard shortcut to the 'Pick alias' and 'Pick block' commands for a more efficient workflow.

### Context Menu in Alias Overview

The Alias Overview provides a context menu (right-click) on alias entries with the following actions:

- **Rename**: Rename an alias directly from the overview
- **Copy to Clipboard**: Copy the alias text to clipboard
- **Move Alias to Other File**: Move an alias from its current file to another file. This is useful if you realize that an alias corresponds to another concept and should be moved to a different file. The backlinks to the alias will be updated automatically.

## Open Backlink Search

The **Open Backlink Search** command opens a search modal for finding files that contain backlinks to specific notes or aliases.

### Search Syntax

The search supports combining multiple backlink references:

**Include Files with `+`:**
* Use `+File` to include a referenced file. Results show files that contain backlinks to this file.
* Multiple `+` selections are combined using an intersection, so the results only include files that contain backlinks to **all selected files**.

**Exclude Files with `-`:**
* Use `-File` to exclude a backlink file and narrow down the `+` selection. The `+` selection only considers files that are referenced by backlinks, without including files excluded with `-`.

**Exact Alias Match with `*`:**
* Use `*Alias` to select a specific alias. The search will only include files where a backlink uses the **exact alias text** (not just the file reference). This is similar to `+File`, but requires the exact alias to be used in the backlink.


## Settings

The plugin provides the following settings in Obsidian's plugin settings tab:

- **Include Aliases in Backlink Search Results**: Controls whether aliases are included in backlink search results (default: false)
- **Remember last filtered files and aliases in backlink search**: Controls whether the last filtered files and aliases are remembered in the backlink search modal (default: false)
- **Focus first backlink search result on open**: When opening a file from the backlink search modal, the cursor is automatically positioned at the first backlink match (default: true)
- **Split Sidebar for Alias Overview**: Controls whether the sidebar splits when opening the Alias Overview (default: true)
- **Open New Leaf for Alias Overview**: Controls whether a new leaf is created or an existing one is reused (default: true)
