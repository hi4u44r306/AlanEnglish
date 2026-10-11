import { useEffect, useReducer } from "react";
import { useAuth } from "../auth/AuthContext";
import { studentPageScope } from "../services/studentPageCache";
import { readStudentLearningHistory, readStudentLearningResume, subscribeStudentLearningResume } from "../services/studentLearningResume";

export default function useStudentLearningResume() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [, refresh] = useReducer(value => value + 1, 0);
    useEffect(() => subscribeStudentLearningResume(refresh), []);
    return readStudentLearningResume(studentPageScope(firebaseUser, role, studentProfile));
}

export function useStudentLearningHistory() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [, refresh] = useReducer(value => value + 1, 0);
    useEffect(() => subscribeStudentLearningResume(refresh), []);
    return readStudentLearningHistory(studentPageScope(firebaseUser, role, studentProfile));
}
