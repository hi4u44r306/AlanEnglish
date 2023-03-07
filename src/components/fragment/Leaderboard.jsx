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
  currentMonth = new Date().toJSON().slice(0, 7);
  currentMonth2 = new Date().toJSON().slice(5, 7);
  currentYear = new Date().toJSON().slice(0, 4);
  getFirstDayOfNextMonth() {
    const date = new Date();

    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }


  lastday = function (y, m) {
    return new Date(y, m + 1, 0).getDate();
  }
  lastdayofmonth = this.lastday(this.currentYear, new Date().toJSON().slice(5, 7))
  // resetDate = this.currentYear + '-' + this.currentMonth2 + '-' + this.lastdayofmonth;
  // resetDateToMs = new Date(this.currentYear + '-' + this.currentMonth2 + '-' + this.lastdayofmonth).getTime()
  resetDate = this.currentYear + '-' + this.currentMonth2 + '-' + new Date(this.currentYear, this.currentMonth2, 0).getDate()


  currentDate = new Date().toJSON().slice(0, 10);

  componentDidMount() {
    // console.log(this.abc)
    const db = firebase.firestore(); /// 使用limit()可選擇顯示資料數量
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const offlinelimit = d.toJSON().slice(0, 10);

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {

      } else {
        window.location.href = '/'
      }
    })


    db.collection("student")
      .where('class', '==', 'A')
      .where('onlinemonth', '==', this.currentMonth)
      .where('totaltimeplayed', '>', 0)
      .orderBy('totaltimeplayed', 'desc')
      .limit(7).get().then((snapshot) => {
        const studentsA = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          studentsA.push(data);
        })
        this.setState({ studentsA: studentsA });
      }).catch((err) => {
        console.lor(err)
      })
    db.collection("student")
      .where('onlinetime', '<=', offlinelimit)
      .where('class', '==', 'A')
      .get().then((snapshot) => {
        const OfflineA = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          OfflineA.push(data);
        })
        this.setState({ OfflineA: OfflineA });
      }).catch((err) => {
        console.lor(err)
      })

    db.collection("student")
      .where('class', '==', 'B')
      .where('onlinemonth', '==', this.currentMonth)
      .where('totaltimeplayed', '>', 0)
      .orderBy('totaltimeplayed', 'desc')
      .limit(7).get().then((snapshot) => {
        const studentsB = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          studentsB.push(data);
        })
        this.setState({ studentsB: studentsB });
      }).catch((err) => {
        console.lor(err)
      })
    db.collection("student")
      .where('onlinetime', '<=', offlinelimit)
      .where('class', '==', 'B')
      .get().then((snapshot) => {
        const OfflineB = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          OfflineB.push(data);
        })
        this.setState({ OfflineB: OfflineB });
      }).catch((err) => {
        console.lor(err)
      })

    db.collection("student")
      .where('class', '==', 'C')
      .where('onlinemonth', '==', this.currentMonth)
      .where('totaltimeplayed', '>', 0)
      .orderBy('totaltimeplayed', 'desc')
      .limit(7).get().then((snapshot) => {
        const studentsC = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          studentsC.push(data);
        })
        this.setState({ studentsC: studentsC });
      }).catch((err) => {
        console.lor(err)
      })
    db.collection("student")
      .where('onlinetime', '<=', offlinelimit)
      .where('class', '==', 'C')
      .get().then((snapshot) => {
        const OfflineC = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          OfflineC.push(data);
        })
        this.setState({ OfflineC: OfflineC });
      }).catch((err) => {
        console.lor(err)
      })

    db.collection("student")
      .where('class', '==', 'D')
      .where('onlinemonth', '==', this.currentMonth)
      .where('totaltimeplayed', '>', 0)
      .orderBy('totaltimeplayed', 'desc')
      .limit(7).get().then((snapshot) => {
        const studentsD = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          studentsD.push(data);
        })
        this.setState({ studentsD: studentsD });
      }).catch((err) => {
        console.lor(err)
      })
    db.collection("student")
      .where('onlinetime', '<=', offlinelimit)
      .where('class', '==', 'D')
      .get().then((snapshot) => {
        const OfflineD = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          OfflineD.push(data);
        })
        this.setState({ OfflineD: OfflineD });
      }).catch((err) => {
        console.lor(err)
      })





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
                {this.resetDate}日結算
              </div>
              <CountdownTimer countdownTimestampMs={1680273592287} />
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