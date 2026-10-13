import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronRight, FiRotateCcw } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import { getStudentMakeups } from "../../services/attendanceService";
import "../Pages/css/Attendance.scss";

// Shown on the homework page only while the student still has makeup items to finish.
const MakeupEntry = () => {
    const { firebaseUser } = useAuth();
    const [pending, setPending] = useState(0);

    useEffect(() => {
        let active = true;
        if (!firebaseUser) return undefined;
        Promise.resolve().then(() => getStudentMakeups(firebaseUser)).then(result => {
            if (!active) return;
            setPending((result?.sessions || []).reduce((total, session) => total + session.items.filter(item => !item.done).length, 0));
        }).catch(() => {});
        return () => { active = false; };
    }, [firebaseUser]);

    if (!pending) return null;
    return (
        <Link className="makeup-entry" to="/student/makeup">
            <FiRotateCcw aria-hidden="true" />
            <span><strong>你有 {pending} 個補課項目</strong>按這裡看老師那天教的影片、聽力和作業</span>
            <FiChevronRight aria-hidden="true" />
        </Link>
    );
};

export default MakeupEntry;
