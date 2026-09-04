export const spokenExampleText = (value: unknown) => {
    const replacements: Array<[RegExp, string]> = [
        [/[\[［【(（{｛]\s*(?:你的)?全名\s*[\]］】)）}｝]/gi, "Amy Lee"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:姓氏|姓)\s*[\]］】)）}｝]/gi, "Lee"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:名字|英文名字|name|first name)\s*[\]］】)）}｝]/gi, "Amy"],
        [/[\[［【(（{｛]\s*(?:你的)?(?:年齡|年紀|age)\s*[\]］】)）}｝]/gi, "ten"],
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
