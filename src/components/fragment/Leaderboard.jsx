import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
// import loudspeaker from '../assets/img/loudspeaker.png'
// import loudspeaker from '../assets/img/mic.png'
import CountdownTimer from './CountdownTimer';
import Containerfull from './Containerfull';
import first from '../assets/img/firstplace.png';
import second from '../assets/img/secondplace.png';
import third from '../assets/img/thirdplace.png';
import Trophy from '../assets/img/trophy.png';
import Sun from '../assets/img/sun.png';
import Sparkles from '../assets/img/sparkles.png';
import Headphone from '../assets/img/leaderboardheadphone.png';

class Leaderboard extends React.Component {


  state = {
    studentsA: null,
    studentsB: null,
    studentsC: null,
    studentsD: null,
  }
  //當月最後一天日期計算
  currentDate = new Date();
  currentYear = this.currentDate.getFullYear();
  currentMonth = this.currentDate.getMonth() + 1;
  lastDayOfMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
  lastDayOfMonthFormatted = this.currentYear + '-' + ('0' + this.currentMonth).slice(-2) + '-' + ('0' + this.lastDayOfMonth).slice(-2);


  //將當月最後一天日期換成Millisecond
  currentDate = new Date();
  currentMonthLastDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
  currentMonthLastDateMs = this.currentMonthLastDate.getTime();

  componentDidMount() {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {

      } else {
        window.location.href = '/'
      }
    })
    const getStudents = (classParam, orderByParam, monthParam, setStateFunc) => {
      const db = firebase.firestore();
      db.collection("student")
        .where('class', '==', classParam)
        .where('onlinemonth', '==', monthParam)
        .where('totaltimeplayed', '>', 0)
        .orderBy(orderByParam, 'desc')
        .get()
        .then((snapshot) => {
          const students = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            students.push(data);
          })
          setStateFunc(students);
        })
        .catch((err) => {
          console.log(err)
        });
    }
    const getOfflineStudents = (classParam, setStateFunc) => {
      const db = firebase.firestore();
      db.collection("student")
        .where('onlinetime', '<=', offlinelimit)
        .where('class', '==', classParam)
        .get()
        .then((snapshot) => {
          const students = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            students.push(data);
          })
          setStateFunc(students);
        })
        .catch((err) => {
          console.log(err)
        });
    }

    const d = new Date();
    d.setDate(d.getDate() - 3);
    const offlinelimit = d.toJSON().slice(0, 10);

    const currentMonth = new Date().toJSON().slice(0, 7);
    getStudents('A', 'totaltimeplayed', currentMonth, (students) => {
      this.setState({ studentsA: students });
    });
    getStudents('B', 'totaltimeplayed', currentMonth, (students) => {
      this.setState({ studentsB: students });
    });
    getStudents('C', 'totaltimeplayed', currentMonth, (students) => {
      this.setState({ studentsC: students });
    });
    getStudents('D', 'totaltimeplayed', currentMonth, (students) => {
      this.setState({ studentsD: students });
    });

    getOfflineStudents('A', (students) => {
      this.setState({ OfflineA: students });
    });
    getOfflineStudents('B', (students) => {
      this.setState({ OfflineB: students });
    });
    getOfflineStudents('C', (students) => {
      this.setState({ OfflineC: students });
    });
    getOfflineStudents('D', (students) => {
      this.setState({ OfflineD: students });
    });
  }

  render() {
    return (
      <Containerfull>
        <div className='leaderboard'>
          <div className='leaderboardmaintitle'>
            <div className='leaderboardtitle'>
              {/* <div>
                  <img className='loudspeaker1' src={loudspeaker} alt='#'/>
                </div> */}
              Leaderboard
              {/* <div>
                  <img className='loudspeaker2' src={loudspeaker} alt='#'/>
                </div> */}
            </div>
            <div className='countdown'>
              <div className='countdownlabel'>
                {this.lastDayOfMonthFormatted}日結算
              </div>
              {/* <div className='countdownlabel'>
                {this.resetDate}日結算
              </div> */}
              <CountdownTimer countdownTimestampMs={this.currentMonthLastDateMs} />
            </div>
          </div>
          {/* A班 */}
          <div className='classtitle'>A 班</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Trophy} alt='排名' />排名</span> </th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>

                {/* <th className='coltitle'>🎵 當日播放次數</th> */}
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Headphone} alt='排名' />本月累積次數</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.studentsA &&
                this.state.studentsA.map((studentsA, index) => {
                  return (
                    <tr key={studentsA.name}>
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
                      <td key={studentsA.name}>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b><span className='font-weight-bold'>{studentsA.name}</span></b>
                          </div>
                        </div>
                      </td>
                      <td key={studentsA.onlinetime}>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b>
                              <span className='font-weight-bold'>
                                <span className={studentsA.onlinetime ? 'text-success' || '' : 'text-danger'}>
                                  {studentsA.onlinetime || '近期無上線'}
                                </span>
                              </span>
                            </b>
                          </div>
                        </div>
                      </td>
                      {/* <td key={studentsA.index}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >
                                  <span className={studentsA.currdatetimeplayed?'text-success' || '':'text-danger'}>
                                    {studentsA.currdatetimeplayed || '0'}次
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td> */}
                      <td key={studentsA.totaltimeplayed}>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b>
                              <span className='font-weight-bold'>{studentsA.totaltimeplayed}次</span>
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
                <td className='coltitle' colSpan="5">!! 這是A班最後一筆資料了 !!</td>
              </tr>
            </tfoot>
          </table>

          {/* A班未上線名單 */}
          <div className='classtitle'>A班3天以上沒上線名單</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班級</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.OfflineA &&
                this.state.OfflineA.map((OfflineA) => {
                  return (
                    <tr key={OfflineA.name}>
                      <td key={OfflineA.name} className=''>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b><span className='font-weight-bold'>{OfflineA.class}</span></b>
                          </div>
                        </div>
                      </td>
                      <td key={OfflineA.name} className=''>
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
          </table>

          {/* B班 */}
          <div className='classtitle'>B 班</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Trophy} alt='排名' />排名</span> </th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>

                {/* <th className='coltitle'>🎵 當日播放次數</th> */}
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Headphone} alt='排名' />本月累積次數</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.studentsB &&
                this.state.studentsB.map((studentsB, index) => {
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
          <div className='classtitle'>B班3天以上沒上線名單</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班級</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.OfflineB &&
                this.state.OfflineB.map((OfflineB, index) => {
                  return (
                    <tr key={index}>
                      <td key={OfflineB.name} className=''>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b><span className='font-weight-bold'>{OfflineB.class}</span></b>
                          </div>
                        </div>
                      </td>
                      <td key={OfflineB.name} className=''>
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
          </table>

          {/* C班 */}
          <div className='classtitle'>C 班</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Trophy} alt='排名' />排名</span> </th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>

                {/* <th className='coltitle'>🎵 當日播放次數</th> */}
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Headphone} alt='排名' />本月累積次數</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.studentsC &&
                this.state.studentsC.map((studentsC, index) => {
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
          <div className='classtitle'>C班3天以上沒上線名單</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班級</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.OfflineC &&
                this.state.OfflineC.map((OfflineC, index) => {
                  return (
                    <tr key={index}>
                      <td key={OfflineC.name} className=''>
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
          </table>

          {/* D班 */}
          <div className='classtitle'>D 班</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitlerank'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Trophy} alt='排名' />排名</span> </th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>

                {/* <th className='coltitle'>🎵 當日播放次數</th> */}
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Headphone} alt='排名' />本月累積次數</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.studentsD &&
                this.state.studentsD.map((studentsD, index) => {
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
          <div className='classtitle'>D班3天以上沒上線名單</div>
          <table className='table table-border'>
            <thead>
              <tr>
                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'>班級</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sun} alt='排名' />姓名</span></th>

                <th className='coltitle'><span className='d-flex align-items-center justify-content-center'><img style={{ marginRight: 7, marginBottom: 5 }} src={Sparkles} alt='排名' />最後上線日</span></th>
              </tr>
            </thead>
            <tbody>
              {
                this.state.OfflineD &&
                this.state.OfflineD.map((OfflineD, index) => {
                  return (
                    <tr key={index}>
                      <td key={OfflineD.name} className=''>
                        <div className='d-flex justify-content-center'>
                          <div className="align-self-center pl-3">
                            <b><span className='font-weight-bold'>{OfflineD.class}</span></b>
                          </div>
                        </div>
                      </td>
                      <td key={OfflineD.name} className=''>
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
          </table>
        </div>
      </Containerfull>
    )
  }
}

export default Leaderboard