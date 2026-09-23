export const spokenExampleText = (value: unknown) => {
    const replacements: Array<[RegExp, string]> = [
        [/[\[［【(（{｛]\s*(?:你的)?全名\s*[\]］】)）}｝]/gi, "Amy Lee"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:姓氏|姓)\s*[\]］】)）}｝]/gi, "Lee"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:名字|英文名字|name|first name)\s*[\]］】)）}｝]/gi, "Amy"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:年齡|年紀|age)\s*[\]］】)）}｝]/gi, "ten"],
        [/[\[［【(（{｛]\s*(?:爸爸|媽媽|爺爺|奶奶)的年齡\s*[\]］】)）}｝]/gi, "forty"],
        [/[\[［【(（{｛]\s*(?:爸爸|媽媽|爺爺|奶奶|兄弟|姊妹)的名字\s*[\]］】)）}｝]/gi, "Alex"],
        [/[\[［【(（{｛]\s*(?:你的)?暱稱\s*[\]］】)）}｝]/gi, "Sunny"],
        [/[\[［【(（{｛]\s*(?:你想換的)?新名字\s*[\]］】)）}｝]/gi, "Amy"],
        [/[\[［【(（{｛]\s*(?:你的)?身分\s*[\]］】)）}｝]/gi, "student"],
        [/[\[［【(（{｛]\s*字母數\s*[\]］】)）}｝]/gi, "four"],
        [/[\[［【(（{｛]\s*名字拼字\s*[\]］】)）}｝]/gi, "A L A N"],
        [/[\[［【(（{｛]\s*(?:你)?喜歡的顏色\s*[\]］】)）}｝]/gi, "blue"],
        [/[\[［【(（{｛]\s*(?:你)?喜歡的食物\s*[\]］】)）}｝]/gi, "pizza"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:城市|居住地)\s*[\]］】)）}｝]/gi, "Taipei"],
        [/[\[［【(（{｛]\s*(?:你的)?國家\s*[\]］】)）}｝]/gi, "Taiwan"]
    ];
    let text = String(value || "").trim().slice(0, 2000);
    for (const [pattern, example] of replacements) text = text.replace(pattern, example);
    text = text
        .replace(/[\[［【(（{｛][^\]］】)）}｝]{1,60}[\]］】)）}｝]/g, " an example ")
        .replace(/[\u3400-\u9fff]+/g, " ")
        .replace(/[＿_]{2,}/g, " an example ")
        .replace(/\s+([,.;!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
    return text.slice(0, 2000);
};

export const speakingAudioSourceMatchesModelAnswer = (sourceText: unknown, modelAnswer: unknown) =>
    String(sourceText || "").trim() === spokenExampleText(modelAnswer);
