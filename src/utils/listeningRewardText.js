export function listeningRewardText(status) {
    if (!status || status.policy_version !== 3) return null;
    if (status.source === "assignment") {
        return {
            title: `老師指定 ${status.valid_listen_count}/${status.required_listens} 次`,
            detail: status.completion_reward_granted
                ? "整份作業完成：+30 XP、+5 AE Points"
                : "本次計入作業，不另計自主獎勵"
        };
    }
    if (status.mastery_rewarded) {
        return { title: "本音檔熟練獎勵已領取", detail: "仍可繼續練習，總聆聽次數照常累計" };
    }
    return {
        title: `自主熟練度 ${status.mastery_count}/10 次`,
        detail: status.limit_reached && status.mastery_count >= 10
            ? "今日已領滿 3 檔，保留進度；隔天再有效聽一次即可領取"
            : "累計 10 次可得 10 XP、1 AE Point（每檔限領一次）"
    };
}
