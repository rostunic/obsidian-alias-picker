import { LinkCache, MetadataCache, TFile } from "obsidian";

type AdvancedMetadataCache = MetadataCache & {
    getBacklinksForFile(file: TFile): { data: Map<string, LinkCache[]> };
}

interface ObsidianFrontmatter {
    aliases?: string[];
    tags?: string[];
    cssclasses?: string[];
}