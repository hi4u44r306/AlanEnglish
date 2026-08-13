import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../assets/scss/ConversationUXGuard.scss";

const getConversationState = () => {
    if (document.querySelector(".conversation-complete-card")) return "complete";
    if (document.querySelector(".speaking-control.is-listening")) return "listening";
    if (document.querySelector(".conversation-feedback.retry")) return "retry";

    if (document.querySelector(".conversation-feedback.correct")) {
        if (document.querySelector(".conversation-cloud-banner.saving")) return "saving";
        if (document.querySelector(".conversation-cloud-banner.error")) return "save-error";
        return "success";
    }

    return "ready";
};

const getCurrentStepToken = () => document.querySelector(".conversation-current-question span")?.textContent || "";

function ConversationUXGuard() {
    const location = useLocation();
    const [state, setState] = useState("ready");
    const [stepToken, setStepToken] = useState("");
    const isConversationPage = location.pathname === "/student/conversation";

    useEffect(() => {
        if (!isConversationPage) return undefined;

        let previousStepToken = "";
        let scrollTimer = null;

        const syncUi = () => {
            const nextState = getConversationState();
            const nextStepToken = getCurrentStepToken();
            setState(nextState);
            setStepToken(nextStepToken);

            const checkButton = document.querySelector(".text-answer-box button");
            if (checkButton && checkButton.textContent !== "送出回答") {
                checkButton.textContent = "送出回答";
            }

            if (nextStepToken && previousStepToken && nextStepToken !== previousStepToken) {
                window.clearTimeout(scrollTimer);
                scrollTimer = window.setTimeout(() => {
                    document.querySelector(".conversation-current-question")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }, 180);
            }

            previousStepToken = nextStepToken || previousStepToken;
        };

        syncUi();
        const observer = new MutationObserver(syncUi);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true
        });

        return () => {
            observer.disconnect();
            window.clearTimeout(scrollTimer);
        };
    }, [isConversationPage]);

    useEffect(() => {
        if (!isConversationPage || state !== "success") return undefined;

        let cancelled = false;
        let attempts = 0;
        let timer = null;

        const advanceWhenSafe = () => {
            if (cancelled) return;
            attempts += 1;

            const saving = document.querySelector(".conversation-cloud-banner.saving");
            const saveError = document.querySelector(".conversation-cloud-banner.error");
            const continueButton = document.querySelector(".continue-conversation-button");

            if (!saving && !saveError && continueButton) {
                timer = window.setTimeout(() => {
                    if (!cancelled) continueButton.click();
                }, 650);
                return;
            }

            if (attempts < 24 && !saveError) {
                timer = window.setTimeout(advanceWhenSafe, 250);
            }
        };

        timer = window.setTimeout(advanceWhenSafe, 450);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isConversationPage, state, stepToken]);

    if (!isConversationPage || state === "complete") return null;

    const handlePrimaryAction = () => {
        if (state === "listening") {
            const finishButton = document.querySelector(".speech-finished-button");
            const microphoneButton = document.querySelector(".microphone-button");
            (finishButton || microphoneButton)?.click();
            return;
        }

        if (state === "ready" || state === "retry") {
            document.querySelector(".microphone-button")?.click();
        }
    };

    const labels = {
        ready: { icon: "🎤", text: "開始回答", disabled: false },
        listening: { icon: "✓", text: "我說完了", disabled: false },
        retry: { icon: "🎤", text: "再試一次", disabled: false },
        saving: { icon: "☁️", text: "答對了，正在儲存進度...", disabled: true },
        success: { icon: "✓", text: "答對！準備下一題...", disabled: true },
        "save-error": { icon: "⚠️", text: "進度尚未儲存，請確認網路", disabled: true }
    };

    const current = labels[state] || labels.ready;

    return (
        <div className={`conversation-action-dock state-${state}`}>
            <button type="button" onClick={handlePrimaryAction} disabled={current.disabled}>
                <span>{current.icon}</span>
                <strong>{current.text}</strong>
            </button>
        </div>
    );
}

export default ConversationUXGuard;
