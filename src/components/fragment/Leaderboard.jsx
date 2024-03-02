import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getFirestore, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import React from 'react'
import '../assets/scss/Leaderboard.scss';
import CountdownTimer from './CountdownTimer';
import first from '../assets/img/firstplace.png';
import second from '../assets/img/secondplace.png';
import third from '../assets/img/thirdplace.png';
import Trophy from '../assets/img/trophy.png';
import Sun from '../assets/img/sun.png';
import Sparkles from '../assets/img/sparkles.png';
import Headphone from '../assets/img/leaderboardheadphone.png';
// import Rocket from '../assets/img/rocket.png';


const Leaderboard = () => {
  const [studentsA, setStudentsA] = useState(null);
  const [studentsB, setStudentsB] = useState(null);
  const [studentsC, setStudentsC] = useState(null);
  const [studentsD, setStudentsD] = useState(null);
  // const [OfflineA, setOfflineA] = useState(null);
  // const [OfflineB, setOfflineB] = useState(null);
  // const [OfflineC, setOfflineC] = useState(null);
  // const [OfflineD, setOfflineD] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = `${currentDate.getMonth() + 1}`.padStart(2, '0');
  const lastDayOfMonth = new Date(currentYear, currentDate.getMonth() + 1, 0).getDate();
  const lastDayOfMonthFormatted = `${currentYear}-${currentMonth}-${lastDayOfMonth}`;


  //將當月最後一天日期換成Millisecond
  const currentMonthLastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const currentMonthLastDateMs = currentMonthLastDate.getTime();

  useEffect(() => {
    const db = getFirestore();
    const auth = getAuth();

    // Redirect to login if user is not authenticated
    onAuthStateChanged(auth, (user) => {
      if (!user) window.location.href = '/';
    });

    const getStudents = async (classParam, orderByParam, monthParam, setStateFunc, offlineLimit) => {
      const q = query(collection(db, 'student'),
        where('class', '==', classParam),
        where('onlinemonth', '==', monthParam),
        where('totaltimeplayed', '>', 0),
        orderBy(orderByParam, 'desc'));

      try {
        const querySnapshot = await getDocs(q);
        const students = [];
        querySnapshot.forEach((doc) => {
          students.push(doc.data());
        });
        setStateFunc(students);
        localStorage.setItem(`class${classParam} online`, JSON.stringify(students));
      } catch (error) {
        console.log(error);
      }
    };

    // const getOfflineStudents = async (classParam, setStateFunc, offlineLimit) => {
    //   const q = query(collection(db, 'student'),
    //     where('class', '==', classParam),
    //     where('onlinetime', '<=', offlineLimit));

    //   try {
    //     const querySnapshot = await getDocs(q);
    //     const students = [];
    //     querySnapshot.forEach((doc) => {
    //       students.push(doc.data());
    //     });
    //     setStateFunc(students);
    //     localStorage.setItem(`class${classParam} offline`, JSON.stringify(students));
    //   } catch (error) {
    //     console.log(error);
    //   }
    // };



    const d = new Date();
    d.setDate(d.getDate() - 3);
    // const offlineLimit = d.toJSON().slice(0, 10);

    const currentMonthFormatted = currentDate.toJSON().slice(0, 7);

    getStudents("A", 'totaltimeplayed', currentMonthFormatted, setStudentsA);
    getStudents("B", 'totaltimeplayed', currentMonthFormatted, setStudentsB);
    getStudents("C", 'totaltimeplayed', currentMonthFormatted, setStudentsC);
    getStudents("D", 'totaltimeplayed', currentMonthFormatted, setStudentsD);

    // getOfflineStudents("A", setOfflineA, offlineLimit);
    // getOfflineStudents("B", setOfflineB, offlineLimit);
    // getOfflineStudents("C", setOfflineC, offlineLimit);
    // getOfflineStudents("D", setOfflineD, offlineLimit);

  }, [currentDate]);

  return (
    // <Containerfull>
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

      {/* A班 */}
      <div className='classtitle'>A 班</div>
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
            studentsA && studentsA.map((student, index) => (
              <tr key={index}>
                <td className='d-flex justify-content-center'>
                  <b className={index < 3 ? 'text-danger' : ''}>
                    {index < 3 ? (
                      <span>
                        <img style={{ marginRight: 7 }} src={[first, second, third][index]} alt={`${index + 1}st`} />
                        {`${index + 1}st`}
                      </span>
                    ) : (
                      index + 1
                    )}
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
                        <span className='font-weight-bold'>{student.totaltimeplayed}次</span>
                      </b>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是A班最後一筆資料了 !!</td>
          </tr>
        </tfoot>
      </table>

      {/* A班未上線名單 */}
      {/* <div className='classtitle-notonline'>A班3天以上沒上線名單</div>
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '班級', icon: Rocket },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
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
            OfflineA && OfflineA.map((OfflineA, index) => {
              return (
                <tr key={index}>
                  <td key={OfflineA.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineA.class}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineA.class} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineA.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineA.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={'text-danger'}>
                              {OfflineA.onlinetime || '從未上線過'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">...</td>
          </tr>
        </tfoot>
      </table> */}

      {/* B班 */}
      <div className='classtitle'>B 班</div>
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
            studentsB && studentsB.map((studentsB, index) => {
              return (
                <tr key={index}>
                  <td className='d-flex justify-content-center'>
                    <b className={index + 1 === 1 || index + 1 === 2 || index + 1 === 3 ? 'text-danger' : ''}>
                      {index + 1 === 1 ?
                        <span>
                          <img style={{ marginRight: 7 }}
                            src={first}
                            alt="1st" />
                          1st
                        </span>
                        :
                        index + 1 === 2 ?
                          <span>
                            <img style={{ marginRight: 7 }}
                              src={second}
                              alt="2nd" />
                            2nd
                          </span>
                          :
                          index + 1 === 3 ?
                            <span>
                              <img style={{ marginRight: 7 }}
                                src={third}
                                alt="3rd" />
                              3rd
                            </span>
                            : index + 1}
                    </b>
                  </td>
                  <td key={studentsB.name}>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{studentsB.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={studentsB.onlinetime}>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={studentsB.onlinetime ? 'text-success' || '' : 'text-danger'}>
                              {studentsB.onlinetime || '近期無上線'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                  {/* <td key={studentsB.index}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >
                                  <span className={studentsB.currdatetimeplayed?'text-success' || '':'text-danger'}>
                                    {studentsB.currdatetimeplayed || '0'}次
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td> */}
                  <td key={studentsB.totaltimeplayed}>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold' >{studentsB.totaltimeplayed}次</span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是B班最後一筆資料了 !!</td>
          </tr>
        </tfoot>
      </table>

      {/* B班未上線名單 */}
      {/* <div className='classtitle-notonline'>B班3天以上沒上線名單</div>
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '班級', icon: Rocket },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
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
            OfflineB && OfflineB.map((OfflineB, index) => {
              return (
                <tr key={index}>
                  <td key={OfflineB.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineB.class}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineB.class} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineB.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineB.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={'text-danger'}>
                              {OfflineB.onlinetime || '從未上線過'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">...</td>
          </tr>
        </tfoot>
      </table> */}

      {/* C班 */}
      <div className='classtitle'>C 班</div>
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
            studentsC && studentsC.map((studentsC, index) => {
              return (
                <tr key={index}>
                  <td className='d-flex justify-content-center ' >
                    <b className={index + 1 === 1 || index + 1 === 2 || index + 1 === 3 ? 'text-danger' : ''}>
                      {index + 1 === 1 ?
                        <span>
                          <img style={{ marginRight: 7 }}
                            src={first}
                            alt="1st" />
                          1st
                        </span>
                        :
                        index + 1 === 2 ?
                          <span>
                            <img style={{ marginRight: 7 }}
                              src={second}
                              alt="2nd" />
                            2nd
                          </span>
                          :
                          index + 1 === 3 ?
                            <span>
                              <img style={{ marginRight: 7 }}
                                src={third}
                                alt="3rd" />
                              3rd
                            </span>
                            : index + 1}
                    </b>
                  </td>
                  <td key={studentsC.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{studentsC.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={studentsC.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={studentsC.onlinetime ? 'text-success' || '' : 'text-danger'}>
                              {studentsC.onlinetime || '近期無上線'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                  {/* <td key={studentsC.index}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >
                                  <span className={studentsC.currdatetimeplayed?'text-success' || '':'text-danger'}>
                                    {studentsC.currdatetimeplayed || '0'}次
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td> */}
                  <td key={studentsC.totaltimeplayed} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold' >{studentsC.totaltimeplayed}次</span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是C班最後一筆資料了 !!</td>
          </tr>
        </tfoot>
      </table>
      {/* C班未上線名單 */}
      {/* <div className='classtitle-notonline'>C班3天以上沒上線名單</div>
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '班級', icon: Rocket },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
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
            OfflineC && OfflineC.map((OfflineC, index) => {
              return (
                <tr key={index}>
                  <td key={OfflineC.class} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineC.class}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineC.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineC.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineC.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={'text-danger'}>
                              {OfflineC.onlinetime || '從未上線過'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">...</td>
          </tr>
        </tfoot>
      </table> */}

      {/* D班 */}
      <div className='classtitle'>D 班</div>
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
            studentsD && studentsD.map((studentsD, index) => {
              return (
                <tr key={index}>
                  <td className='d-flex justify-content-center '>
                    <b className={index + 1 === 1 || index + 1 === 2 || index + 1 === 3 ? 'text-danger' : ''}>
                      {index + 1 === 1 ?
                        <span>
                          <img style={{ marginRight: 7 }}
                            src={first}
                            alt="1st" />
                          1st
                        </span>
                        :
                        index + 1 === 2 ?
                          <span>
                            <img style={{ marginRight: 7 }}
                              src={second}
                              alt="2nd" />
                            2nd
                          </span>
                          :
                          index + 1 === 3 ?
                            <span>
                              <img style={{ marginRight: 7 }}
                                src={third}
                                alt="3rd" />
                              3rd
                            </span>
                            : index + 1}
                    </b>
                  </td>
                  <td key={studentsD.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{studentsD.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={studentsD.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={studentsD.onlinetime ? 'text-success' || '' : 'text-danger'}>
                              {studentsD.onlinetime || '近期無上線'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                  {/* <td key={studentsD.index}>
                            <div className='d-flex justify-content-center'>
                              <div className="align-self-center pl-3">
                                <b>
                                  <span className='font-weight-bold' >
                                    <span className={studentsD.currdatetimeplayed?'text-success' || '':'text-danger'}>
                                      {studentsD.currdatetimeplayed || '0'}次
                                    </span>
                                  </span>
                                </b>
                              </div>
                            </div>
                          </td> */}
                  <td key={studentsD.totaltimeplayed} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold' >{studentsD.totaltimeplayed}次</span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">!! 這是D班最後一筆資料了 !!</td>
          </tr>
        </tfoot>
      </table>
      {/* D班未上線名單 */}
      {/* <div className='classtitle-notonline'>D班3天以上沒上線名單</div>
      <table className='table table-border'>
        <thead>
          <tr>
            {[
              { text: '班級', icon: Rocket },
              { text: '姓名', icon: Sun },
              { text: '日期', icon: Sparkles },
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
            OfflineD &&
            OfflineD.map((OfflineD, index) => {
              return (
                <tr key={index}>
                  <td key={OfflineD.name} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineD.class}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineD.class} className=''>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b><span className='font-weight-bold'>{OfflineD.name}</span></b>
                      </div>
                    </div>
                  </td>
                  <td key={OfflineD.onlinetime} className=' '>
                    <div className='d-flex justify-content-center'>
                      <div className="align-self-center pl-3">
                        <b>
                          <span className='font-weight-bold'>
                            <span className={'text-danger'}>
                              {OfflineD.onlinetime || '從未上線過'}
                            </span>
                          </span>
                        </b>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })
          }
        </tbody>
        <tfoot>
          <tr>
            <td className='coltitle' colSpan="5">...</td>
          </tr>
        </tfoot>
      </table> */}
    </div>
    // </Containerfull>
  )
};

export default Leaderboard;