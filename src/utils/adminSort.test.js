import { sortLinkItemsAscending } from "./linkSort";
import { sortMusicTracksAscending } from "./musicTrackSort";

describe("admin ascending-order helpers", () => {
    it("sorts link titles naturally within each configured category", () => {
        const result = sortLinkItemsAscending([
            { id: 3, category: "exercise", title: "習作本 10", sort_order: 1 },
            { id: 1, category: "listening", title: "聽力本 1", sort_order: 1 },
            { id: 2, category: "exercise", title: "習作本 2", sort_order: 99 }
        ]);

        expect(result.map(item => item.title)).toEqual(["習作本 2", "習作本 10", "聽力本 1"]);
    });

    it("sorts tracks by ascending sort order with a stable natural fallback", () => {
        const result = sortMusicTracksAscending([
            { id: 4, sort_order: 20, page: "P10", music_name: "P10.mp3" },
            { id: 3, sort_order: 10, page: "P2", music_name: "P2.mp3" },
            { id: 2, sort_order: 10, page: "P1", music_name: "P1.mp3" },
            { id: 1, sort_order: null, page: "P0", music_name: "P0.mp3" }
        ]);

        expect(result.map(item => item.id)).toEqual([2, 3, 4, 1]);
    });
});
