import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
    ref, set, get, child, onValue
} from 'firebase/database';
import { rtdb } from './firebase-config';

function CheckStudent() {
    const [attendanceByGrade, setAttendanceByGrade] = useState({});
    const [studentsCache, setStudentsCache] = useState([]);  // Cache all students
    const [manualName, setManualName] = useState("");
    const [manualGrade, setManualGrade] = useState(1);
    const firstSignSet = useRef(new Set());
    const timers = useRef({});

    // Load all students once
    useEffect(() => {
        const studentsRef = ref(rtdb, 'students');
        onValue(studentsRef, snapshot => {
            const data = snapshot.val() || {};
            const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
            setStudentsCache(list);
        });
    }, []);

    // Real-time listener for attendance
    useEffect(() => {
        const attRef = ref(rtdb, 'attendance');
        onValue(attRef, snapshot => {
            const data = snapshot.val() || {};
            const grouped = {};
            Object.entries(data).forEach(([id, v]) => {
                const g = v.grade;
                if (!grouped[g]) grouped[g] = [];
                grouped[g].push({ id, name: v.name, expired: v.expired });
            });
            setAttendanceByGrade(grouped);
        });
    }, []);

    // Initialize scanner
    useEffect(() => {
        const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 300, height: 100 } }, false);
        scanner.render(onScanSuccess, onScanError);
        return () => { scanner.clear().catch(() => { }); };
    },);

    async function onScanSuccess(decodedText) {
        const id = decodedText.trim();
        if (!id) return;
        // Find student from cached list
        const student = studentsCache.find(s => s.id === id);
        if (!student) {
            alert('未找到學生，請手動輸入姓名');
            return;
        }
        // Check if already signed in
        const attSnap = await get(child(ref(rtdb), `attendance/${id}`));
        if (attSnap.exists()) {
            alert('已經在排隊了');
            return;
        }
        if (student.expired) alert('該學生已到期');
        // Write attendance record
        await set(ref(rtdb, `attendance/${id}`), {
            name: student.name,
            grade: student.grade,
            timestamp: new Date().toISOString(),
            expired: student.expired
        });
        handleTimer(student.grade);
    }

    function onScanError(err) {
        console.warn('掃描錯誤:', err);
    }

    // Manual entry
    async function handleManualEntry() {
        const name = manualName.trim();
        if (!name) return;
        // Filter cached students by name and grade
        const candidates = studentsCache.filter(s => s.name === name && s.grade === manualGrade);
        if (!candidates.length) {
            alert('找不到該年級學生');
            return;
        }
        const student = candidates[0];
        const id = student.id;
        const attSnap = await get(child(ref(rtdb), `attendance/${id}`));
        if (attSnap.exists()) {
            alert('已經在排隊了');
            return;
        }
        if (student.expired) alert('該學生已到期');
        await set(ref(rtdb, `attendance/${id}`), {
            name: student.name,
            grade: student.grade,
            timestamp: new Date().toISOString(),
            expired: student.expired
        });
        handleTimer(student.grade);
        setManualName('');
    }

    // Timer logic
    function handleTimer(grade) {
        if (!firstSignSet.current.has(grade)) {
            firstSignSet.current.add(grade);
            timers.current[grade] = setTimeout(() => {
                alert('請確認是否所有學生都已到齊');
            }, 10 * 60 * 1000);
        } else {
            if (timers.current[grade]) {
                clearTimeout(timers.current[grade]);
                delete timers.current[grade];
            }
        }
    }

    return (
        <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
            <h1>學生條碼簽到系統</h1>
            <div>
                <label>手動輸入姓名:</label>
                <input
                    type="text"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="學生姓名"
                />
                <label>年級:</label>
                <select value={manualGrade} onChange={e => setManualGrade(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}年級</option>)}
                </select>
                <button onClick={handleManualEntry}>加入</button>
            </div>
            <div id="reader" style={{ width: '300px', margin: '1rem 0' }}></div>
            <div>
                {Object.keys(attendanceByGrade).sort().map(g => (
                    <div key={g} style={{ marginBottom: '1rem' }}>
                        <h2>{g}年級 ({attendanceByGrade[g].length})</h2>
                        <ul>
                            {attendanceByGrade[g].map(s => (
                                <li key={s.id}>{s.name}{s.expired ? ' (已到期)' : ''}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CheckStudent;
