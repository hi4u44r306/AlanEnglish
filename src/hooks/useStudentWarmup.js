import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getAccessibleBook } from "../services/contentAccessService";
import { getGamificationLeaderboard } from "../services/gamificationService";
import { fetchStudentPageCache, readStudentPageCache, studentPageScope } from "../services/studentPageCache";
import { findResumeBook, readStudentLearningHistory } from "../services/studentLearningResume";
import { getStudentMaterialCategories } from "../utils/studentLearning";

const MAX_BOOKS = 8;
const idle = callback => (typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(callback, { timeout: 4000 })
    : window.setTimeout(callback, 1500));
const cancelIdle = handle => (typeof window.cancelIdleCallback === "function"
    ? window.cancelIdleCallback(handle)
    : window.clearTimeout(handle));

// Once a student is in and the browser is idle, fetch what the next taps will need: the code for
// the other student pages, and the track list of each book they can open. Pages then paint from
// the snapshot cache straight away and refresh quietly. Nothing here changes what a student may
// see — every request is the same one the page itself would make.
export default function useStudentWarmup(catalog) {
    const { firebaseUser, role, studentProfile } = useAuth();
    const scope = studentPageScope(firebaseUser, role, studentProfile);
    const isStudent = role === "student";

    useEffect(() => {
        if (!isStudent || !firebaseUser) return undefined;
        const handle = idle(() => {
            import("../components/Pages/StudentAssignments").catch(() => {});
            import("../components/Pages/TextbookSpeakingChallenge").catch(() => {});
            import("../components/Pages/WeeklyReport").catch(() => {});
        });
        return () => cancelIdle(handle);
    }, [isStudent, firebaseUser]);

    useEffect(() => {
        if (!isStudent || !firebaseUser || !scope || !catalog) return undefined;
        let cancelled = false;
        const books = getStudentMaterialCategories(catalog.categories).flatMap(category => category.books);
        // Books this student has been listening to come first; the rest follow in shelf order.
        const recent = readStudentLearningHistory(scope).map(bookmark => findResumeBook(bookmark, books)).filter(Boolean);
        const codes = [...new Set([...recent, ...books].filter(book => book.code && book.locked !== true).map(book => book.code))]
            // Capped before checking the cache, so repeat runs never creep past the first few books.
            .slice(0, MAX_BOOKS)
            .filter(code => !readStudentPageCache(scope, `book:${code}`));
        const rankingScope = studentProfile?.class ? "class" : "overall";
        const rankingKey = `leaderboard:${rankingScope}:week`;
        const needsRanking = !readStudentPageCache(scope, rankingKey);
        if (!codes.length && !needsRanking) return undefined;
        const handle = idle(async () => {
            // One at a time, so warming up never competes with what the student is doing now.
            if (needsRanking) await fetchStudentPageCache(scope, rankingKey, () => getGamificationLeaderboard(firebaseUser, "week", null, rankingScope)).catch(() => {});
            for (const code of codes) {
                if (cancelled) return;
                await fetchStudentPageCache(scope, `book:${code}`, () => getAccessibleBook(firebaseUser, code)).catch(() => {});
            }
        });
        return () => { cancelled = true; cancelIdle(handle); };
    }, [isStudent, firebaseUser, scope, catalog, studentProfile?.class]);
}
