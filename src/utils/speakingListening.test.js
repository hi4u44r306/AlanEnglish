import { matchedSpeakingTracks, speakingListeningContext, speakingListeningPath, speakingListeningSource } from "./speakingListening";

const source = speakingListeningSource({ id: 7, books: { id: 1, code: "Workbook 1" }, generation_metadata: { source_pages: [18, 19, 20] } });
const track = (id, page, extra = {}) => ({ id, book_id: 1, page, audio_url: "signed-audio", ...extra });

it("only matches explicit pages in the identical book, including parts and complete ranges", () => {
    expect(matchedSpeakingTracks(source, { book: { id: 1 }, tracks: [track(1, "P.18"), track(2, "P.18～20"), track(3, "P.18 part 1", { base_page: 18 }), track(4, "P.17～18"), track(5, "P.21"), track(6, "P.18", { book_id: 2 }), track(7, "P.18", { audio_url: null }), track(8, "P.18 bonus")] }).map(item => item.id)).toEqual([1, 2, 3]);
    expect(matchedSpeakingTracks(source, { book: { id: 2 }, tracks: [track(1, "P.18")] })).toEqual([]);
});

it("does not infer a source from a title or malformed page data", () => {
    expect(speakingListeningSource({ id: 7, title: "P.18", books: { id: 1, code: "W1" } })).toBeNull();
    expect(speakingListeningSource({ id: 7, books: { id: 1, code: "W1" }, source_pages: [18, "unknown"] })).toBeNull();
});

it("roundtrips only known tracks with the same set and mode, even after reload", () => {
    const path = speakingListeningPath(source, 7, "challenge", [track(2, "18")]);
    expect(path).toBe("/student/books/Workbook%201?speaking=7&mode=challenge&tracks=2");
    const context = speakingListeningContext(path.slice(path.indexOf("?")));
    expect(context.returnPath).toBe("/student/speaking-challenges/7?mode=challenge");
    expect([...context.trackIds]).toEqual(["2"]);
    ["?speaking=0&mode=easy&tracks=1", "?speaking=7&mode=unknown&tracks=1", "?speaking=7&mode=easy&tracks=1,evil", "?speaking=7&mode=easy"].forEach(search => expect(speakingListeningContext(search)).toBeNull());
});
