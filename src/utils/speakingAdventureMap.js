// Keep one continuous landscape. More levels scale the full image rather than add tiles.
const LANDMARK_X = [310, 690, 440, 650, 330, 710, 410, 620, 290, 680, 430, 630];

export const buildSpeakingAdventureRoute = (_bookKey, items) => {
    const height = Math.max(1200, items.length * 88);
    const top = 155;
    const bottom = height - 150;
    const interval = items.length > 1 ? (bottom - top) / (items.length - 1) : 0;
    const nodes = items.map((item, index) => ({
        id: item.id,
        x: LANDMARK_X[index % LANDMARK_X.length],
        y: Math.round(top + index * interval),
        zone: index >= Math.ceil(items.length * 0.72) ? "volcano"
            : index >= Math.ceil(items.length * 0.43) ? "highland" : "grassland"
    }));
    const path = nodes.map((node, index) => `${index ? "L" : "M"} ${node.x} ${node.y}`).join(" ");
    return { nodes, height, path };
};
