import { centerOnLevel, findLevelToFocus } from "./centerOnLevel";

const lesson = (id, classes = "") => `<button class="speaking-challenge-lesson ${classes}" data-question-set-id="${id}"></button>`;
const mount = html => { document.body.innerHTML = html; document.querySelectorAll("button").forEach(b => { b.scrollIntoView = jest.fn(); }); };

describe("findLevelToFocus", () => {
    it("prefers the level just left, then the next target, then the one in play, then the last completed", () => {
        mount(lesson(1, "is-completed") + lesson(2, "is-completed") + lesson(3, "is-current") + lesson(4, "is-next-target") + lesson(5));
        expect(findLevelToFocus(document, 2).dataset.questionSetId).toBe("2");
        expect(findLevelToFocus(document, 0).dataset.questionSetId).toBe("4");
        mount(lesson(1, "is-completed") + lesson(2, "is-current") + lesson(3));
        expect(findLevelToFocus(document, 0).dataset.questionSetId).toBe("2");
        mount(lesson(1, "is-completed") + lesson(2, "is-completed") + lesson(3));
        expect(findLevelToFocus(document, 0).dataset.questionSetId).toBe("2");
    });
});

describe("centerOnLevel", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.useRealTimers(); document.body.innerHTML = ""; });

    it("centers right away and keeps re-centering for a while after the page layout shifts", () => {
        mount(lesson(7, "is-next-target"));
        const node = document.querySelector("button");
        const cancel = centerOnLevel(() => node);
        expect(node.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(node.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
        jest.advanceTimersByTime(2100);
        expect(node.scrollIntoView.mock.calls.length).toBeGreaterThanOrEqual(5);
        cancel();
    });

    it("stops as soon as the student scrolls or touches, and stays stopped on later refreshes", () => {
        mount(lesson(7, "is-next-target"));
        const node = document.querySelector("button");
        const state = { moved: false };
        const cancel = centerOnLevel(() => node, { state });
        window.dispatchEvent(new Event("touchmove"));
        jest.advanceTimersByTime(2100);
        expect(node.scrollIntoView).toHaveBeenCalledTimes(1);
        cancel();

        centerOnLevel(() => node, { state });
        jest.advanceTimersByTime(2100);
        expect(node.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("cancel() clears the pending re-centering", () => {
        mount(lesson(7, "is-next-target"));
        const node = document.querySelector("button");
        centerOnLevel(() => node)();
        jest.advanceTimersByTime(2100);
        expect(node.scrollIntoView).toHaveBeenCalledTimes(1);
    });
});
