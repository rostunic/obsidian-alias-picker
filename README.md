# Alias Picker
The Alias Picker plugin for Obsidian introduces two commands: 'Pick alias' and 'Pick block'.
These commands simplify the process of modifying wiki or Markdown links within your notes.

## Features:
Pick alias: Easily select an alternative alias for the current link from the available aliases for the file.

Pick block: Modify the referenced block within the file using the '#^BlockIdentifier' syntax.

When renaming an alias, the plugin will automatically update all instances of that alias throughout your vault.
It also supplies a command "Open Alias Overview" to view all aliases in your vault and see the usages of each alias.

## How to use:
With the cursor on the link, execute the 'Pick alias' or 'Pick block' command from the plugin menu or via keyboard shortcuts.
Choose from the available blocks or aliases to make your desired changes.

You should assign a keyboard shortcut to the 'Pick alias' and 'Pick block' commands for a more efficient workflow.

## Open Backlink Search

The **Open Backlink Search** command opens a search modal for finding files that contain backlinks to specific notes or aliases.

### Search with References

* Use `+File` to select a referenced file. The results show files that contain backlinks to this file.
* Use `-File` to exclude a backlink file and narrow down the `+` selection. The `+` selection only considers files that are referenced by backlinks, without including files excluded with `-`.

Multiple `+` selections are combined using an intersection: only files that contain backlinks to **all selected files** are shown.
