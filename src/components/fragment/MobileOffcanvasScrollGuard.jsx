import { useEffect } from "react";
import "../assets/scss/MobileOffcanvasScrollGuard.scss";

const BLOCKING_SELECTOR = ".ae-mobile-offcanvas.show, .ae-mobile-offcanvas.showing";

const clearBootstrapScrollResidue = () => {
    if (typeof document === "undefined") return;

    const activeBlockingLayer = document.querySelector(
        ".modal.show, .modal.showing, .offcanvas.show, .offcanvas.showing"
    );

    if (activeBlockingLayer) return;

    document.documentElement.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("padding-right");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
    document.body.classList.remove("modal-open");
};

function MobileOffcanvasScrollGuard() {
    useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return undefined;
        }

        const html = document.documentElement;
        const body = document.body;
        let locked = false;
        let savedScrollY = 0;
        let originalBodyStyles = null;
        let boundScrollBody = null;
        let startTouchY = 0;
        let unlockTimer = null;

        const restoreInlineStyle = (element, property, value) => {
            if (value) {
                element.style.setProperty(property, value);
            } else {
                element.style.removeProperty(property);
            }
        };

        const lockBackground = () => {
            if (locked) return;

            savedScrollY = window.scrollY || window.pageYOffset || 0;
            originalBodyStyles = {
                position: body.style.position,
                top: body.style.top,
                left: body.style.left,
                right: body.style.right,
                width: body.style.width
            };

            locked = true;
            html.classList.add("ae-offcanvas-scroll-locked");
            body.classList.add("ae-offcanvas-scroll-locked");

            body.style.position = "fixed";
            body.style.top = `-${savedScrollY}px`;
            body.style.left = "0";
            body.style.right = "0";
            body.style.width = "100%";
            body.style.overflow = "hidden";
            html.style.overflow = "hidden";
        };

        const unlockBackground = () => {
            if (!locked) {
                clearBootstrapScrollResidue();
                return;
            }

            locked = false;
            html.classList.remove("ae-offcanvas-scroll-locked");
            body.classList.remove("ae-offcanvas-scroll-locked");

            restoreInlineStyle(body, "position", originalBodyStyles?.position || "");
            restoreInlineStyle(body, "top", originalBodyStyles?.top || "");
            restoreInlineStyle(body, "left", originalBodyStyles?.left || "");
            restoreInlineStyle(body, "right", originalBodyStyles?.right || "");
            restoreInlineStyle(body, "width", originalBodyStyles?.width || "");

            originalBodyStyles = null;

            window.requestAnimationFrame(() => {
                clearBootstrapScrollResidue();
                window.scrollTo(0, savedScrollY);
            });
        };

        const handleTouchStart = event => {
            if (!event.touches?.length) return;
            startTouchY = event.touches[0].clientY;
        };

        const handleTouchMove = event => {
            if (!boundScrollBody || !event.touches?.length) return;

            const currentTouchY = event.touches[0].clientY;
            const deltaY = currentTouchY - startTouchY;
            const atTop = boundScrollBody.scrollTop <= 0;
            const atBottom = Math.ceil(
                boundScrollBody.scrollTop + boundScrollBody.clientHeight
            ) >= boundScrollBody.scrollHeight;

            if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
                event.preventDefault();
                return;
            }

            startTouchY = currentTouchY;
        };

        const unbindScrollBoundary = () => {
            if (!boundScrollBody) return;

            boundScrollBody.removeEventListener("touchstart", handleTouchStart);
            boundScrollBody.removeEventListener("touchmove", handleTouchMove);
            boundScrollBody = null;
        };

        const bindScrollBoundary = scrollBody => {
            if (!scrollBody || scrollBody === boundScrollBody) return;

            unbindScrollBoundary();
            boundScrollBody = scrollBody;
            boundScrollBody.addEventListener("touchstart", handleTouchStart, {
                passive: true
            });
            boundScrollBody.addEventListener("touchmove", handleTouchMove, {
                passive: false
            });
        };

        const syncScrollGuard = () => {
            const offcanvas = document.querySelector(BLOCKING_SELECTOR);

            if (offcanvas) {
                window.clearTimeout(unlockTimer);
                lockBackground();
                bindScrollBoundary(offcanvas.querySelector(".offcanvas-body"));
                return;
            }

            unbindScrollBoundary();

            if (locked) {
                window.clearTimeout(unlockTimer);
                unlockTimer = window.setTimeout(unlockBackground, 80);
            }
        };

        syncScrollGuard();

        const observer = new MutationObserver(syncScrollGuard);
        observer.observe(body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["class"]
        });

        window.addEventListener("pageshow", syncScrollGuard);
        window.addEventListener("orientationchange", syncScrollGuard);

        return () => {
            observer.disconnect();
            window.removeEventListener("pageshow", syncScrollGuard);
            window.removeEventListener("orientationchange", syncScrollGuard);
            window.clearTimeout(unlockTimer);
            unbindScrollBoundary();
            unlockBackground();
        };
    }, []);

    return null;
}

export default MobileOffcanvasScrollGuard;
