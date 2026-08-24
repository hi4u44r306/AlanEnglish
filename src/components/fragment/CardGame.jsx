import React, { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext";
import { recordGameResult } from "../../services/gamificationService";
import "../assets/scss/Game.scss";
import Name from "./Name";
import ContainerGame from "./ContainerGame";

const createSessionKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export default function CardGame({
    open,
    onClose,
    bookname,
    pagename,
    questionsinmusic
}) {
    const { firebaseUser, role } = useAuth();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const questions = [questionsinmusic];

    const closeAndReset = () => {
        onClose();
        setCurrentQuestion(0);
    };

    const grantGameReward = () => {
        if (!firebaseUser || role !== "student") return;

        const gameKey = `${bookname || "book"}:${pagename || "page"}`;
        recordGameResult(firebaseUser, {
            gameKey,
            sessionKey: createSessionKey(),
            won: true
        })
            .then(result => {
                const xp = Number(result?.reward?.xp_added || 0);
                const points = Number(result?.reward?.points_added || 0);
                if (xp > 0 || points > 0) {
                    toast.success(`遊戲獎勵 +${xp} XP · +${points} P`, {
                        className: "gamenotification",
                        position: "top-center",
                        autoClose: 1800,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        theme: "colored"
                    });
                }
            })
            .catch(error => {
                console.warn("遊戲完成，但 XP / 點數紀錄失敗:", error);
            });
    };

    const finishNotification = () => {
        toast.success("測驗完成！", {
            className: "gamenotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored"
        });

        grantGameReward();
        window.setTimeout(closeAndReset, 2000);
    };

    const success = () => {
        toast.success("答對了！下一題", {
            className: "gamenotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored"
        });
    };

    const error = () => {
        toast.error("選錯囉！再試一次", {
            className: "gamenotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored"
        });
    };

    const handleCardClick = card => {
        const questionList = questions[0] || [];
        const question = questionList[currentQuestion];
        if (!question) return;

        const isCorrect = card.name === question.questionText;
        const nextQuestion = currentQuestion + 1;

        if (!isCorrect) {
            error();
            return;
        }

        if (nextQuestion === questionList.length) {
            finishNotification();
            return;
        }

        success();
        window.setTimeout(() => {
            if (nextQuestion < questionList.length) {
                setCurrentQuestion(nextQuestion);
            }
        }, 1800);
    };

    if (!open) return null;

    const questionList = questions[0] || [];
    const current = questionList[currentQuestion];
    if (!current) return null;

    return (
        <ContainerGame>
            <div className="Overlay" />
            <div className="gamebox">
                <div className="gamebox2">
                    <div className="boxtitle">
                        <button type="button" className="closebtn" onClick={closeAndReset} aria-label="關閉遊戲">❌</button>
                        <Name name={bookname} className="game-name" />
                        <Name name={pagename} className="game-name" />
                        <div className="questionindex">第 {currentQuestion + 1} 題 / 共 {questionList.length} 題</div>
                    </div>
                    <div className="questionbox">
                        <div className="questionsection">
                            <div className="題目">Question :</div>
                            <div className="questiontext">
                                {current.questionText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")}
                            </div>
                        </div>
                        <div className="questionsection">
                            <div className="deckcontainer">
                                {(current.questiondeck || []).map(card => (
                                    <button
                                        type="button"
                                        className="deck"
                                        key={`${currentQuestion}-${card.image}-${card.name}`}
                                        onClick={() => handleCardClick(card)}
                                    >
                                        <img
                                            className="deckimage"
                                            src={require(`../assets/img/${card.image}`).default}
                                            alt=""
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ContainerGame>
    );
}
