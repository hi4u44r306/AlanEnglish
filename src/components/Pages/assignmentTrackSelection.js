export const mergeTrackIds = (currentIds, additionalIds) => (
    Array.from(new Set([...(currentIds || []), ...(additionalIds || [])]))
);

export const removeTrackIds = (currentIds, removedIds) => {
    const removed = new Set(removedIds || []);
    return (currentIds || []).filter(id => !removed.has(id));
};

export const groupSelectedTracks = (tracks, selectedIds) => {
    const selected = new Set(selectedIds || []);
    const groups = new Map();

    (tracks || []).forEach(track => {
        if (!selected.has(track.id) || !track.book) return;

        const bookKey = String(track.book.id);
        if (!groups.has(bookKey)) {
            groups.set(bookKey, {
                book: track.book,
                tracks: []
            });
        }
        groups.get(bookKey).tracks.push(track);
    });

    return Array.from(groups.values());
};
