const MAP_WIDTH = 793;
const MAP_HEIGHT = 1983;
const MAX_ROWS = 7;
const PREFERRED_LEVELS_PER_ROW = 4;

// Measured from the centre of each horizontal road on the v7 map asset.
const ROAD_ROW_Y = [10.8, 21.7, 34.1, 47.1, 59.6, 72.2, 84.8];
const ROAD_START_X = 14;
const ROAD_END_X = 86;

const evenlySpacedExtraRows = (rowCount, extraCount) => {
    if (!extraCount) return new Set();
    if (extraCount === 1) return new Set([Math.floor(rowCount / 2)]);
    return new Set(Array.from({ length: extraCount }, (_, index) =>
        Math.round(index * (rowCount - 1) / (extraCount - 1))
    ));
};

export const distributeSpeakingLevels = total => {
    if (!Number.isInteger(total) || total <= 0) return [];
    const rowCount = Math.min(MAX_ROWS, Math.max(1,
        total < PREFERRED_LEVELS_PER_ROW ? total : Math.ceil(total / PREFERRED_LEVELS_PER_ROW)
    ));
    const baseCount = Math.floor(total / rowCount);
    const extraRows = evenlySpacedExtraRows(rowCount, total % rowCount);
    return Array.from({ length: rowCount }, (_, rowIndex) => baseCount + (extraRows.has(rowIndex) ? 1 : 0));
};

const rowXPositions = count => {
    if (count <= 1) return [(ROAD_START_X + ROAD_END_X) / 2];
    return Array.from({ length: count }, (_, index) =>
        Number((ROAD_START_X + index * (ROAD_END_X - ROAD_START_X) / (count - 1)).toFixed(2))
    );
};

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const rowCounts = distributeSpeakingLevels(items.length);
    const rowIndexes = rowCounts.length === 1
        ? [0]
        : rowCounts.map((_, index) => Math.round(index * (MAX_ROWS - 1) / (rowCounts.length - 1)));
    let itemIndex = 0;
    const nodes = rowCounts.flatMap((count, rowIndex) => {
        const positions = rowXPositions(count);
        const orderedPositions = rowIndex % 2 === 0 ? positions : [...positions].reverse();
        return orderedPositions.map(x => {
            const item = items[itemIndex++];
            const mapRow = rowIndexes[rowIndex];
            const progress = items.length > 1 ? (itemIndex - 1) / (items.length - 1) : 0;
            return {
                id: item.id,
                x,
                xMobile: x,
                y: ROAD_ROW_Y[mapRow],
                row: mapRow + 1,
                zone: progress >= 0.72 ? "volcano" : progress >= 0.43 ? "highland" : "grassland"
            };
        });
    });

    return {
        nodes,
        rowCounts,
        aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`
    };
};
