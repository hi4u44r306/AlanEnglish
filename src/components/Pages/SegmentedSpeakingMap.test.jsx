import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SegmentedSpeakingMap from "./SegmentedSpeakingMap";
import { buildSegmentedSpeakingRoute } from "../../utils/segmentedSpeakingMap";
import { buildSpeakingMapPilot } from "../../utils/speakingMapPilot";
import { buildCartoonSpeakingRoute } from "../../utils/speakingCartoonMap";

describe("segmented scene loading", () => {
    const originalObserver = global.IntersectionObserver;
    const originalMatchMedia = window.matchMedia;
    const observers = [];
    const route = buildSegmentedSpeakingRoute("book-3", Array.from({ length: 36 }, (_, index) => ({ id: index + 1 })));
    beforeEach(() => {
        observers.length = 0;
        global.IntersectionObserver = jest.fn(function(callback, options) {
            this.callback = callback; this.options = options;
            this.observe = jest.fn(); this.disconnect = jest.fn(); observers.push(this);
        });
    });
    afterEach(() => {
        global.IntersectionObserver = originalObserver;
        window.matchMedia = originalMatchMedia;
    });

    test("phones omit side assets; resizing adds only nearby decorations without changing the route", () => {
        let onChange;
        const media = {
            matches: false,
            addEventListener: jest.fn((event, handler) => { onChange = handler; }),
            removeEventListener: jest.fn(),
        };
        window.matchMedia = jest.fn(() => media);
        const cartoon = buildCartoonSpeakingRoute("book-2", Array.from({ length: 50 }, (_, id) => ({ id })));
        const { container, unmount } = render(<SegmentedSpeakingMap route={cartoon} />);
        const centerline = container.querySelector(".speaking-map-centerline");
        const canvas = container.querySelector(".speaking-segmented-canvas");
        const initialImages = canvas.querySelectorAll("img").length;
        expect(container.querySelector(".speaking-map-side-scenery")).toBeNull();
        act(() => { media.matches = true; onChange(); });
        const sides = container.querySelector(".speaking-map-side-scenery");
        expect(sides).toHaveAttribute("aria-hidden", "true");
        expect(sides.querySelectorAll("img").length).toBeGreaterThan(0);
        expect(sides.querySelectorAll("img").length).toBeLessThan(4);
        expect(canvas.querySelectorAll("img")).toHaveLength(initialImages);
        expect(container.querySelector(".speaking-map-centerline")).toBe(centerline);
        expect(centerline).toHaveAttribute("d", cartoon.path);
        fireEvent.error(sides.querySelector("img"));
        expect(screen.queryByRole("button", { name: "重試載入場景" })).not.toBeInTheDocument();
        act(() => { media.matches = false; onChange(); });
        expect(container.querySelector(".speaking-map-side-scenery")).toBeNull();
        unmount();
        expect(media.removeEventListener).toHaveBeenCalledWith("change", onChange);
    });

    test("full books use their painted theme and only load nearby scene instances", () => {
        const cartoon = buildCartoonSpeakingRoute("book-5", Array.from({ length: 50 }, (_, id) => ({ id })));
        const { container } = render(<SegmentedSpeakingMap route={cartoon} />);
        expect(container.querySelector('.is-cartoon')).not.toBeNull();
        expect(container.querySelector('.speaking-map-centerline')).toHaveAttribute('stroke', 'none');
        expect(container.querySelector('.speaking-continuous-road__surface')).toBeNull();
        expect(container.querySelectorAll('.speaking-scene-tile')).toHaveLength(13);
        expect(container.querySelectorAll('img').length).toBeLessThan(4);
        expect(container.querySelectorAll('.is-sky')).toHaveLength(13);
    });

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
