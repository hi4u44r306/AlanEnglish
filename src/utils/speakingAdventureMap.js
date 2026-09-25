const hashKey = value => {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const nodeX = (bookKey, item) => 270 + hashKey(`${bookKey}:${item.id}`) % 460;

export const buildSpeakingAdventureRoute = (bookKey, items) => {
    const nodes = items.map((item, index) => ({
        id: item.id,
        x: nodeX(bookKey, item),
        y: 115 + index * 184,
        zone: index >= Math.ceil(items.length * 0.72) ? "volcano"
            : index >= Math.ceil(items.length * 0.43) ? "highland" : "grassland"
    }));
    const height = Math.max(330, (nodes.at(-1)?.y || 115) + 165);
    let path = nodes.length ? `M ${nodes[0].x} ${nodes[0].y}` : "";
    for (let index = 1; index < nodes.length; index += 1) {
        const previous = nodes[index - 1];
        const current = nodes[index];
        const bend = (hashKey(`${bookKey}:${previous.id}:${current.id}`) % 161) - 80;
        const middleX = Math.min(790, Math.max(210, (previous.x + current.x) / 2 + bend));
        const middleY = (previous.y + current.y) / 2;
        path += ` C ${previous.x} ${previous.y + 70}, ${middleX} ${middleY - 30}, ${middleX} ${middleY}`;
        path += ` S ${current.x} ${current.y - 65}, ${current.x} ${current.y}`;
    }
    return { nodes, height, path };
};
