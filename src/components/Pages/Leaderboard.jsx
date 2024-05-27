import { useEffect, useState } from "react";
import React from 'react'
import './css/Leaderboard.scss';
import CountdownTimer from '../fragment/CountdownTimer';
// import first from '../assets/img/firstplace.png';
// import second from '../assets/img/secondplace.png';
// import third from '../assets/img/thirdplace.png';
import Trophy from '../assets/img/trophy.png';
import Sun from '../assets/img/sun.png';
import Sparkles from '../assets/img/sparkles.png';
import Headphone from '../assets/img/leaderboardheadphone.png';
import { rtdb } from "./firebase-config";
import { onValue, ref } from "firebase/database";
// import Rocket from '../assets/img/rocket.png';


const Leaderboard = () => {

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = `${currentDate.getMonth() + 1}`.padStart(2, '0');
  const lastDayOfMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
  const lastDayOfMonthFormatted = `${currentYear}-${currentMonth}-${lastDayOfMonth}`;


  // //將當月最後一天日期換成Millisecond
  const currentMonthLastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const currentMonthLastDateMs = currentMonthLastDate.getTime();

  const [classFilters, setClassFilters] = useState({
    A: true,
    B: true,
    C: true,
    D: true,
    // Teacher: true,

  });
  const [studentData, setStudentData] = useState([]);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);


  useEffect(() => {

    // const date = new Date();
    // date.setDate(date.getDate() - 3);
    // const offlineLimit = date.toJSON().slice(0, 10);

    const getStudents = async () => {
      const studentsRef = ref(rtdb, 'student'); // Assuming 'students' is your node

      onValue(studentsRef, (snapshot) => {
        const students = [];
        snapshot.forEach((childSnapshot) => {
          const childKey = childSnapshot.key;
          const childData = childSnapshot.val();
          students.push({ id: childKey, ...childData });
          // ...
        });
        setStudentData(students)
      });
    };
    getStudents();
  }, []);



  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    if (name === "selectAll") {
      const updatedFilters = {};
      for (const className in classFilters) {
        updatedFilters[className] = checked;
      }
      setClassFilters(updatedFilters);
    } else {
      setClassFilters(prevFilters => ({
        ...prevFilters,
        [name]: checked
      }));
    }
  };

  return (
    <div className='leaderboard'>
      <div className='leaderboardmaintitle'>
        <div className='leaderboardtitle'>
          Leaderboard
        </div>
        <div className='countdown'>
          <div className='countdownlabel'>
            {lastDayOfMonthFormatted}日結算
          </div>
          <CountdownTimer countdownTimestampMs={currentMonthLastDateMs} />
        </div>
      </div>
      <div className="class-filters">
        <label className="class-filter">
          <input
            type="checkbox"
            name="selectAll"
            checked={Object.values(classFilters).every(val => val)}
            onChange={handleCheckboxChange}
          />
          All
        </label>
        {Object.keys(classFilters).map(className => (
          <label key={className} className="class-filter">
            <input
              type="checkbox"
              name={className}
              checked={classFilters[className]}
              onChange={handleCheckboxChange}
            />
            {className}班
          </label>
        ))}

        <label className="class-filter">
          <input
            type="checkbox"
            checked={dateFilterEnabled}
            onChange={() => setDateFilterEnabled(!dateFilterEnabled)}
          />
          三天未上限
        </label>
      </div>

      {/* Online Data */}
      {/* <div className='leaderboardtitle'>
        Students
      </div> */}
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '班級', icon: Trophy },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
              { text: '月次數', icon: Headphone },
            ].map((col, index) => (
              <th className='coltitle' key={index}>
                <span className='d-flex align-items-center justify-content-center'>
                  <img style={{ marginRight: 7, marginBottom: 5 }} src={col.icon} alt={col.text} />
                  {col.text}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {
            studentData.map((student, index) => {
              const currentDate = new Date();
              const threeDaysAgo = new Date(currentDate.getTime() - (3 * 24 * 60 * 60 * 1000));
              const studentOnlineTime = new Date(student.onlinetime);

              const isClassFiltered = classFilters[student.class];
              const isDateFiltered = !dateFilterEnabled || studentOnlineTime <= threeDaysAgo; // Apply date filter only if enabled
              if (isClassFiltered && isDateFiltered) {
                return (
                  <tr key={index}>
                    <td className='d-flex justify-content-center'>
                      <b>
                        <span className='font-weight-bold'>{student.class}</span>
                      </b>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className='font-weight-bold'>{student.name}</span>
                          </b>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className={`font-weight-bold ${student.onlinetime ? 'text-success' : 'text-danger'}`}>
                              {student.onlinetime || '近期無上線'}
                            </span>
                          </b>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className='font-weight-bold'>{student.Monthtotaltimeplayed}次</span>
                          </b>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              return null;
            })
          }

        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是最底部了 !!</td>
          </tr>
        </tfoot>
      </table>


      {/* Offline Data */}
      {/* <div className='leaderboardtitle'>
        Offline
      </div>
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '排名', icon: Trophy },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
              { text: '月次數', icon: Headphone },
            ].map((col, index) => (
              <th className='coltitle' key={index}>
                <span className='d-flex align-items-center justify-content-center'>
                  <img style={{ marginRight: 7, marginBottom: 5 }} src={col.icon} alt={col.text} />
                  {col.text}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {
            OfflinestudentData.map((student, index) => {
              if (classFilters[student.class]) {
                return (
                  <tr key={index}>
                    <td className='d-flex justify-content-center'>
                      <b>
                        <span className='font-weight-bold'>{student.class}</span>
                      </b>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className='font-weight-bold'>{student.name}</span>
                          </b>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className={`font-weight-bold ${student.onlinetime ? 'text-success' : 'text-danger'}`}>
                              {student.onlinetime || '近期無上線'}
                            </span>
                          </b>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className='d-flex justify-content-center'>
                        <div className="align-self-center pl-3">
                          <b>
                            <span className='font-weight-bold'>{student.Monthtotaltimeplayed}次</span>
                          </b>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }
              return null;
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是最底部了 !!</td>
          </tr>
        </tfoot>
      </table> */}
    </div>

  )
};

export default Leaderboard;