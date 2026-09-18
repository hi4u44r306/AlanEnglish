type WeekBounds = {
    previous_start_at: string;
    start_at: string;
    end_at: string;
};

type SpeakingProgress = {
    question_set_id: number | string;
    question_id: number | string;
    completed_at: string | null;
};

type SpeakingQuestionSet = {
    id: number | string;
    title?: string | null;
    topic?: string | null;
    books?: { id?: number | string; name?: string | null; code?: string | null } | null;
    speaking_questions?: Array<{ id: number | string }> | null;
};

type SpeakingReward = {
    source_key?: string | null;
    xp_delta?: number | string | null;
    points_delta?: number | string | null;
    created_at?: string | null;
};

const timestamp = (value: unknown) => {
    const parsed = new Date(String(value || "")).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const relationOne = <T>(value: T | T[] | null | undefined): T | null => (
    Array.isArray(value) ? value[0] || null : value || null
);

const inRange = (value: unknown, start: string, end: string) => {
    const valueTime = timestamp(value);
    return valueTime >= timestamp(start) && valueTime < timestamp(end);
};

const uniqueQuestions = (items: SpeakingProgress[]) => (
    new Map(items.map(item => [Number(item.question_id), item])).size
);

export const summarizeWeeklySpeakingChallenge = ({
    progress = [],
    questionSets = [],
    rewards = [],
    week
}: {
    progress?: SpeakingProgress[];
    questionSets?: SpeakingQuestionSet[];
    rewards?: SpeakingReward[];
    week: WeekBounds;
}) => {
    const currentProgress = progress.filter(item => inRange(item.completed_at, week.start_at, week.end_at));
    const previousProgress = progress.filter(item => inRange(item.completed_at, week.previous_start_at, week.start_at));
    const completedBySet = new Map<number, SpeakingProgress[]>();

    for (const item of progress) {
        if (!item.completed_at || timestamp(item.completed_at) >= timestamp(week.end_at)) continue;
        const setId = Number(item.question_set_id);
        completedBySet.set(setId, [...(completedBySet.get(setId) || []), item]);
    }

    const setSummaries = questionSets.map(set => {
        const setId = Number(set.id);
        const questionIds = new Set((set.speaking_questions || []).map(question => Number(question.id)));
        const completedItems = (completedBySet.get(setId) || [])
            .filter(item => questionIds.has(Number(item.question_id)));
        const completedQuestionIds = new Set(completedItems.map(item => Number(item.question_id)));
        const totalQuestions = questionIds.size;
        const completedQuestions = completedQuestionIds.size;
        const completedAt = totalQuestions > 0 && completedQuestions === totalQuestions
            ? completedItems.reduce((latest, item) => (
                timestamp(item.completed_at) > timestamp(latest) ? String(item.completed_at) : latest
            ), "")
            : null;
        const book = relationOne(set.books);

        return {
            id: setId,
            title: String(set.title || set.topic || "口說小關卡"),
            book_id: Number(book?.id || 0) || null,
            book_name: String(book?.name || book?.code || "教材口說"),
            completed_questions: completedQuestions,
            total_questions: totalQuestions,
            progress_percent: totalQuestions ? Math.round((completedQuestions / totalQuestions) * 100) : 0,
            completed_at: completedAt,
            last_practiced_at: completedItems.reduce((latest, item) => (
                timestamp(item.completed_at) > timestamp(latest) ? String(item.completed_at) : latest
            ), "") || null
        };
    }).filter(item => item.completed_questions > 0);

    const currentClears = setSummaries
        .filter(item => item.completed_at && inRange(item.completed_at, week.start_at, week.end_at))
        .sort((left, right) => timestamp(right.completed_at) - timestamp(left.completed_at));
    const previousClears = setSummaries.filter(item => (
        item.completed_at && inRange(item.completed_at, week.previous_start_at, week.start_at)
    ));
    const latestChallenge = [...setSummaries]
        .sort((left, right) => timestamp(right.last_practiced_at) - timestamp(left.last_practiced_at))[0] || null;
    const currentRewards = rewards.filter(item => inRange(item.created_at, week.start_at, week.end_at));
    const previousRewards = rewards.filter(item => inRange(item.created_at, week.previous_start_at, week.start_at));

    return {
        completed_questions: uniqueQuestions(currentProgress),
        previous_completed_questions: uniqueQuestions(previousProgress),
        completed_challenges: currentClears.length,
        previous_completed_challenges: previousClears.length,
        all_time_completed_challenges: setSummaries.filter(item => item.completed_at).length,
        started_challenges: setSummaries.length,
        xp_awarded: currentRewards.reduce((sum, item) => sum + Number(item.xp_delta || 0), 0),
        ae_points_awarded: currentRewards.reduce((sum, item) => sum + Number(item.points_delta || 0), 0),
        previous_xp_awarded: previousRewards.reduce((sum, item) => sum + Number(item.xp_delta || 0), 0),
        current_challenge: latestChallenge,
        recent_clears: currentClears.slice(0, 3)
    };
};
