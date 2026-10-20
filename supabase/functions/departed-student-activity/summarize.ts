// Pure calculation for the "departed students come back" report. No I/O, so it can be unit tested.
//
// A student counts as departed when they have an enrollment row with status withdrawn/graduated and
// no current (active/paused) enrollment. A student who left and was restored is not departed.

export type DepartedEnrollment = {
    student_id: number;
    status: string;
    departed_at: string | null;
    access_ends_at: string | null;
    class_code: string | null;
};

export type StudentActivity = {
    id: number;
    name: string | null;
    chinese_name: string | null;
    english_name: string | null;
    account_status: string | null;
    last_login_at: string | null;
    last_active_at: string | null;
};

export type DepartedStudentRow = {
    id: number;
    display_name: string;
    class_code: string | null;
    departed_on: string | null;
    last_login_at: string | null;
    last_active_at: string | null;
    returned: boolean;
};

export type DepartedSummary = {
    total_departed: number;
    accounts_archived: number;
    returned_after_departure: number;
    never_returned: number;
    logged_in_last_30_days: number;
    logged_in_last_90_days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toTime = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
};

// Departure day as a UTC-midnight timestamp (departed_at, else access_ends_at, else unknown).
const departedOn = (row: DepartedEnrollment): string | null => row.departed_at || row.access_ends_at || null;

// The last departure of each student (a student can have several closed windows).
export const latestDepartures = (
    enrollments: DepartedEnrollment[],
    currentStudentIds: Set<number>
): Map<number, DepartedEnrollment> => {
    const latest = new Map<number, DepartedEnrollment>();
    for (const row of enrollments) {
        if (row.status !== "withdrawn" && row.status !== "graduated") continue;
        if (currentStudentIds.has(row.student_id)) continue;
        const known = latest.get(row.student_id);
        if (!known || (toTime(departedOn(row)) ?? -Infinity) >= (toTime(departedOn(known)) ?? -Infinity)) {
            latest.set(row.student_id, row);
        }
    }
    return latest;
};

export const summarizeDepartedActivity = (
    departures: Map<number, DepartedEnrollment>,
    students: StudentActivity[],
    now: Date = new Date(),
    listLimit = 30
): { summary: DepartedSummary; students: DepartedStudentRow[] } => {
    const nowMs = now.getTime();
    const byId = new Map(students.map(student => [student.id, student]));
    const rows: DepartedStudentRow[] = [];
    const summary: DepartedSummary = {
        total_departed: 0,
        accounts_archived: 0,
        returned_after_departure: 0,
        never_returned: 0,
        logged_in_last_30_days: 0,
        logged_in_last_90_days: 0
    };

    for (const [studentId, enrollment] of departures) {
        const student = byId.get(studentId);
        if (!student) continue;

        summary.total_departed += 1;
        if (student.account_status === "archived") summary.accounts_archived += 1;

        const departedMs = toTime(departedOn(enrollment));
        const loginMs = toTime(student.last_login_at);
        // Returned = signed in after the departure day ended. Without a departure date we cannot tell.
        const returned = loginMs !== null && departedMs !== null && loginMs >= departedMs + DAY_MS;
        if (returned) summary.returned_after_departure += 1;
        else summary.never_returned += 1;

        if (loginMs !== null && nowMs - loginMs <= 30 * DAY_MS) summary.logged_in_last_30_days += 1;
        if (loginMs !== null && nowMs - loginMs <= 90 * DAY_MS) summary.logged_in_last_90_days += 1;

        rows.push({
            id: student.id,
            display_name: student.chinese_name || student.name || student.english_name || `學生 ${student.id}`,
            class_code: enrollment.class_code,
            departed_on: departedOn(enrollment),
            last_login_at: student.last_login_at,
            last_active_at: student.last_active_at,
            returned
        });
    }

    rows.sort((left, right) => (toTime(right.last_login_at) ?? -Infinity) - (toTime(left.last_login_at) ?? -Infinity));
    return { summary, students: rows.slice(0, listLimit) };
};
