import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SegmentedSpeakingMap from "./SegmentedSpeakingMap";
import { buildSegmentedSpeakingRoute } from "../../utils/segmentedSpeakingMap";
import { buildSpeakingMapPilot } from "../../utils/speakingMapPilot";

describe("segmented scene loading", () => {
    const originalObserver = global.IntersectionObserver;
    const observers = [];
    const route = buildSegmentedSpeakingRoute("book-3", Array.from({ length: 36 }, (_, index) => ({ id: index + 1 })));
    beforeEach(() => {
        observers.length = 0;
        global.IntersectionObserver = jest.fn(function(callback, options) {
            this.callback = callback; this.options = options;
            this.observe = jest.fn(); this.disconnect = jest.fn(); observers.push(this);
        });
    });
    afterEach(() => { global.IntersectionObserver = originalObserver; });

    test("painted pilot keeps the invisible centerline without a second visible road or bridge", () => {
        const pilot = buildSpeakingMapPilot(Array.from({ length: 8 }, (_, index) => ({ id: index })));
        const { container } = render(<SegmentedSpeakingMap route={pilot} />);
        expect(container.querySelector('.speaking-map-centerline')).toHaveAttribute('d', pilot.path);
        expect(container.querySelector('.speaking-map-centerline')).toHaveAttribute('stroke', 'none');
        expect(container.querySelector('.speaking-continuous-road__surface')).toBeNull();
        expect(container.querySelector('.speaking-map-pilot-bridge')).toBeNull();
        expect(container.querySelector('.speaking-map-start-flag')).not.toBeNull();
    });

    test("initial target loads only nearby images; entering another section loads that image", () => {
        const { container, unmount } = render(<SegmentedSpeakingMap route={route}><button>真實關卡入口</button></SegmentedSpeakingMap>);
        const initialImages = container.querySelectorAll("img").length;
        expect(initialImages).toBeGreaterThan(0);
        expect(initialImages).toBeLessThan(route.scenes.length / 2);
        expect(container.querySelector('[data-scene-index="0"] img')).toBeNull();
        expect(observers[0].options.rootMargin).toBe("650px 0px");
        act(() => observers[0].callback([{ isIntersecting: true }]));
        expect(container.querySelectorAll("img")).toHaveLength(initialImages + 1);
        expect(observers[0].disconnect).toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "真實關卡入口" })).toBeInTheDocument();
        unmount();
        observers.forEach(observer => expect(observer.disconnect).toHaveBeenCalled());
    });

    test("returning to a high level eagerly loads that section instead of the start", () => {
        const { container } = render(<SegmentedSpeakingMap route={route} initialLevelIndex={35} />);
        expect(container.querySelector('[data-scene-index="0"] img')).toHaveAttribute("loading", "eager");
        expect(container.querySelector(`[data-scene-index="${route.scenes.length - 1}"] img`)).toBeNull();
    });

    test("older browsers fall back to native lazy loading; a failed tile can be retried", () => {
        global.IntersectionObserver = undefined;
        const { container } = render(<SegmentedSpeakingMap route={route} />);
        const image = container.querySelector('[data-scene-index="0"] img');
        expect(image).toHaveAttribute("loading", "lazy");
        fireEvent.error(image);
        fireEvent.click(screen.getByRole("button", { name: "重試載入場景" }));
        expect(container.querySelector('[data-scene-index="0"] img')).toBeInTheDocument();
    });
});
