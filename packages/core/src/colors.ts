/** Color tokens that the host app provides to the explorer. */
export interface ExplorerSemanticColors {
    backdrop: string;
    functionBadge: string;
    highlightHoverBg: string;
    lookupBadge: string;
    materializedViewBadge: string;
    scrollThumb: string;
    scrollThumbHover: string;
    selectionBg: string;
    selectionSubtle: string;
    shadowLight: string;
    shadowMedium: string;
}

export interface ExplorerChartColors {
    palette: string[];
}

export interface ExplorerColorConfig {
    semantic: ExplorerSemanticColors;
    chart: ExplorerChartColors;
}
