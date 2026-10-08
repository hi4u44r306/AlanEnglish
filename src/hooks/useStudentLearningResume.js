import { useEffect, useReducer } from "react";
import { useAuth } from "../auth/AuthContext";
import { studentPageScope } from "../services/studentPageCache";
import { readStudentLearningResume, subscribeStudentLearningResume } from "../services/studentLearningResume";

export default function useStudentLearningResume() {
    const { firebaseUser, role, studentProfile } = useAuth();
    const [, refresh] = useReducer(value => value + 1, 0);
    useEffect(() => subscribeStudentLearningResume(refresh), []);
    return readStudentLearningResume(studentPageScope(firebaseUser, role, studentProfile));
}
