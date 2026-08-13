import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { completeTourProgress, getTourProgress } from "../../services/tourService";
import "../assets/scss/GuidedTour.scss";

const TOUR_VERSION = 1;

const getVisibleTarget = selector => {
    if (!selector || typeof document === "undefined") return null;

    const targets = Array.from(document.querySelectorAll(selector));
    return targets.find(element => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }) || null;
};

const buildSystemTour = role => {
    const staff = role === "teacher" || role === "admin";

    return {
        key: staff ? "staff-system-tour" : "student-system-tour",
        title: staff ? "Alan English 管理功能導覽" : "歡迎來到 Alan English",
        steps: staff ? [
            {
                title: "歡迎使用 Teacher / Admin",
                body: "這裡可以查看學生學習狀況、示範英文對話、管理帳號與教材。第一次只需要花不到一分鐘認識主要入口。"
            },
            {
                selector: "[data-tour='home']",
                title: "管理首頁",
                body: "從這裡回到學生學習狀況 Dashboard，久未登入或久未學習的學生會有清楚標記。"
            },
            {
                selector: "[data-tour='conversation']",
                title: "英文對話示範",
                body: "老師與管理員可以完整示範語音 Conversation，但 Demo Mode 不會寫進學生學習紀錄。"
            },
            {
                selector: "[data-tour='accounts']",
                title: "學生與帳號管理",
                body: "需要查看或管理學生帳號時，從管理工具區進入。"
            },
            {
                selector: "[data-tour='help']",
                title: "隨時重新觀看",
                body: "忘記功能位置時，按「使用教學」就能重新打開導覽。"
            }
        ] : [
            {
                title: "嗨！歡迎來到 Alan English 👋",
                body: "你可以在這裡練聽力、英文口說、使用 AI 教材，並讓學習進度自動保存。"
            },
            {
                selector: "[data-tour='home']",
                title: "我的首頁",
                body: "從這裡回到自己的學習首頁，查看目前的學習資料。"
            },
            {
                selector: "[data-tour='conversation']",
                title: "英文對話",
                body: "按這裡進入生活情境英文口說。用麥克風回答，AE 會即時顯示聽到的英文。"
            },
            {
                selector: "[data-tour='materials']",
                title: "我的教材",
                body: "習作本、聽力本與課本都集中在教材區，選到真正的教材頁後選單會自動收起。"
            },
            {
                selector: "[data-tour='help']",
                title: "忘記了也沒關係",
                body: "按「使用教學」可以隨時重新看一次，不需要擔心第一次沒有記住。"
            }
        ]
    };
};

const CONVERSATION_TOUR = {
    key: "conversation-tour",
    title: "英文對話使用教學",
    steps: [
        {
            title: "準備開始 Speaking Mission",
            body: "看 Alex 的問題後，只要按麥克風並用英文回答。語音回答會自動判斷，不需要再另外按 Check。"
        },
        {
            selector: ".conversation-current-question",
            title: "先看現在的問題",
            body: "這裡會顯示目前第幾關、英文問題與需要時的中文提示。"
        },
        {
            selector: ".microphone-button",
            title: "按一次開始說話",
            body: "按一下麥克風後直接說英文；停頓後 AE 會自動完成，也可以自己按「我說完了」。"
        },
        {
            selector: ".show-hint-button, .conversation-hint-box",
            title: "不知道怎麼說？",
            body: "可以使用提示。回答錯誤也不會跳題，系統會留在原題讓你再試一次。"
        },
        {
            selector: ".conversation-mobile-progress, .mission-progress",
            title: "進度會自動保存",
            body: "每完成一關就同步到 Alan English 雲端。重新整理或換裝置登入，都可以從上次的關卡繼續。"
        }
    ]
};

function GuidedTour() {
    const location = useLocation();
    const { firebaseUser, role } = useAuth();
    const systemTour = useMemo(() => buildSystemTour(role), [role]);
    const [activeTour, setActiveTour] = useState(null);
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const conversationPage = location.pathname === "/student/conversation";
    const step = activeTour?.steps?.[stepIndex] || null;

    useEffect(() => {
        if (!firebaseUser || !role) return undefined;

        let cancelled = false;

        const loadInitialTour = async () => {
            try {
                const systemResult = await getTourProgress(firebaseUser, systemTour.key, TOUR_VERSION);
                if (cancelled) return;

                if (!systemResult?.progress?.completed) {
                    setStepIndex(0);
                    setActiveTour(systemTour);
                    return;
                }

                if (conversationPage) {
                    const conversationResult = await getTourProgress(firebaseUser, CONVERSATION_TOUR.key, TOUR_VERSION);
                    if (!cancelled && !conversationResult?.progress?.completed) {
                        setStepIndex(0);
                        setActiveTour(CONVERSATION_TOUR);
                    }
                }
            } catch (error) {
                console.warn("讀取使用教學狀態失敗:", error);
            }
        };

        const timer = window.setTimeout(loadInitialTour, 650);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [firebaseUser, role, systemTour, conversationPage]);

    useEffect(() => {
        const openTour = () => {
            setStepIndex(0);
            setActiveTour(conversationPage ? CONVERSATION_TOUR : systemTour);
        };

        window.addEventListener("ae:open-tour", openTour);
        return () => window.removeEventListener("ae:open-tour", openTour);
    }, [conversationPage, systemTour]);

    useEffect(() => {
        if (!step) {
            setTargetRect(null);
            return undefined;
        }

        const updateTarget = () => {
            const target = getVisibleTarget(step.selector);
            if (!target) {
                setTargetRect(null);
                return;
            }

            const rect = target.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            });
        };

        updateTarget();
        const timer = window.setTimeout(updateTarget, 180);
        window.addEventListener("resize", updateTarget);
        window.addEventListener("scroll", updateTarget, true);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("resize", updateTarget);
            window.removeEventListener("scroll", updateTarget, true);
        };
    }, [step]);

    useEffect(() => {
        if (!activeTour) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [activeTour]);

    const finishTour = async () => {
        const finishedTour = activeTour;
        setActiveTour(null);
        setStepIndex(0);

        if (!firebaseUser || !finishedTour) return;

        try {
            await completeTourProgress(firebaseUser, finishedTour.key, TOUR_VERSION);

            if (finishedTour.key === systemTour.key && conversationPage) {
                const result = await getTourProgress(firebaseUser, CONVERSATION_TOUR.key, TOUR_VERSION);
                if (!result?.progress?.completed) {
                    window.setTimeout(() => {
                        setStepIndex(0);
                        setActiveTour(CONVERSATION_TOUR);
                    }, 450);
                }
            }
        } catch (error) {
            console.warn("儲存使用教學狀態失敗:", error);
        }
    };

    const nextStep = () => {
        if (!activeTour) return;
        if (stepIndex >= activeTour.steps.length - 1) {
            finishTour();
            return;
        }
        setStepIndex(previous => previous + 1);
    };

    const previousStep = () => setStepIndex(previous => Math.max(0, previous - 1));

    if (!activeTour || !step) return null;

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
    const tooltipWidth = Math.min(360, viewportWidth - 32);
    const preferredLeft = targetRect ? targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2) : (viewportWidth - tooltipWidth) / 2;
    const safeLeft = Math.max(16, Math.min(preferredLeft, viewportWidth - tooltipWidth - 16));
    const placeBelow = targetRect ? targetRect.bottom + 260 < viewportHeight : false;
    const tooltipStyle = targetRect
        ? placeBelow
            ? { width: tooltipWidth, left: safeLeft, top: Math.max(16, targetRect.bottom + 16) }
            : { width: tooltipWidth, left: safeLeft, bottom: Math.max(16, viewportHeight - targetRect.top + 16) }
        : { width: tooltipWidth, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

    return (
        <div className="ae-tour-layer" role="dialog" aria-modal="true" aria-label={activeTour.title}>
            {targetRect && (
                <div
                    className="ae-tour-highlight"
                    style={{
                        top: Math.max(4, targetRect.top - 6),
                        left: Math.max(4, targetRect.left - 6),
                        width: targetRect.width + 12,
                        height: targetRect.height + 12
                    }}
                />
            )}

            {!targetRect && <div className="ae-tour-backdrop" />}

            <div className="ae-tour-card" style={tooltipStyle}>
                <div className="ae-tour-card-topline">
                    <span>{activeTour.title}</span>
                    <button type="button" onClick={finishTour}>跳過</button>
                </div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>

                <div className="ae-tour-progress-row">
                    <div className="ae-tour-dots">
                        {activeTour.steps.map((item, index) => (
                            <span key={`${activeTour.key}-${item.title}`} className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} />
                        ))}
                    </div>
                    <span>{stepIndex + 1} / {activeTour.steps.length}</span>
                </div>

                <div className="ae-tour-actions">
                    {stepIndex > 0 ? (
                        <button type="button" className="secondary" onClick={previousStep}>← 上一步</button>
                    ) : <span />}
                    <button type="button" className="primary" onClick={nextStep}>
                        {stepIndex === activeTour.steps.length - 1 ? "完成導覽 ✓" : "下一步 →"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GuidedTour;
