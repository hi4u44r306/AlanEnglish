import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router keeps the document scroll position between routes by default.
 * Each real page change should instead begin at the top, for every role.
 */
const RouteScrollToTop = () => {
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname]);

    return null;
};

export default RouteScrollToTop;
