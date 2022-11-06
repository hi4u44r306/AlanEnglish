import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
// import loudspeaker from '../assets/img/loudspeaker.png'
import loudspeaker from '../assets/img/mic.png'
import CountdownTimer from './CountdownTimer';
import Containerfull from './Containerfull';

class Leaderboard extends React.Component{

  
  state ={
    studentsA:null,
    studentsB:null,
    studentsC:null,
    studentsD:null,
  }
  currentMonth = new Date().toJSON().slice(0, 7);
  currentMonth2 = new Date().toJSON().slice(5, 7);
  currentYear = new Date().toJSON().slice(0,4);
  getFirstDayOfNextMonth() {
    const date = new Date();
  
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }
  nextMonth = new Date().getMonth()+3;

  firstdayofmonth = this.currentMonth + '-01';
  lastday = function(y,m){
    return  new Date(y, m +1, 0).getDate();
  }
  lastdayofmonth = this.lastday(this.currentYear,new Date().toJSON().slice(5, 7))
  resetDate = this.currentYear + '-' + this.currentMonth2 + '-' + this.lastdayofmonth;
  resetDateToMs = new Date(this.currentYear + '-' +this.currentMonth2 + '-' + this.lastdayofmonth).getTime()

  componentDidMount() {
    const db = firebase.firestore(); /// 使用limit()可選擇顯示資料數量
    db.collection("student")
    .where('class', '==', 'A')
    .where('onlinemonth', '==', this.currentMonth)
    .where('totaltimeplayed', '>', 0)
    .orderBy('totaltimeplayed', 'desc')
    .limit(7).get().then((snapshot) => {
      const studentsA = [];
      snapshot.forEach((doc)=>{
        const data = doc.data();
        studentsA.push(data);
      })
      this.setState({studentsA: studentsA});
    });
    db.collection("student")
    .where('class', '==', 'B')
    .where('onlinemonth', '==', this.currentMonth)
    .where('totaltimeplayed', '>', 0)
    .orderBy('totaltimeplayed', 'desc')
    .limit(7).get().then((snapshot) => {
      const studentsB = [];
      snapshot.forEach((doc)=>{
        const data = doc.data();
        studentsB.push(data);
      })
      this.setState({studentsB: studentsB});
    });
    db.collection("student")
    .where('class', '==', 'C')
    .where('onlinemonth', '==', this.currentMonth)
    .where('totaltimeplayed', '>', 0)
    .orderBy('totaltimeplayed', 'desc')
    .limit(7).get().then((snapshot) => {
      const studentsC = [];
      snapshot.forEach((doc)=>{
        const data = doc.data();
        studentsC.push(data);
      })
      this.setState({studentsC: studentsC});
    });
    db.collection("student")
    .where('class', '==', 'D')
    .where('onlinemonth', '==', this.currentMonth)
    .where('totaltimeplayed', '>', 0)
    .orderBy('totaltimeplayed', 'desc')
    .limit(7).get().then((snapshot) => {
      const studentsD = [];
      snapshot.forEach((doc)=>{
        const data = doc.data();
        studentsD.push(data);
      })
      this.setState({studentsD: studentsD});
    });
  }

  render(){
    return(
      <Containerfull>
          <div className='leaderboard'>
            <div className='leaderboardtitle'>
              <div>
                <img className='loudspeaker1' src={loudspeaker} alt='#'/>
              </div>
                播放次數排行榜
              <div>
                <img className='loudspeaker2' src={loudspeaker} alt='#'/>
              </div>
            </div>
            <div className='countdown'>
              <div className='countdownlabel'>
                {this.resetDate}日結算
              </div>
              <CountdownTimer countdownTimestampMs={1669852800000}/> 
            </div>
            {/* <div className='prize'>
              <div>各班前七名獎品待定</div>
            </div>   */}

            {/* A班 */}
            <div className='classtitle'>A班</div>
            <table className='table table-border'>
              <thead>
                <tr>
                  <th className='coltitle'>🏆 Rank</th>
                  <th className='coltitle'>👦 Name 👩</th>
                  <th className='coltitle'>✨ 最新上線日期</th>
                  <th className='coltitle'>🎵 當日播放次數</th>
                  <th className='coltitle'>🎧 本月累積次數</th>
                </tr>
              </thead>
              <tbody>
              {
                  this.state.studentsA &&
                  this.state.studentsA.map((studentsA, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center'>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>
                            {index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}
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
                                  <span className={studentsA.onlinetime?'text-success' || '':'text-danger'}>
                                    {studentsA.onlinetime || '近期無上線'}
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsA.index}>
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
                        </td>
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
                  <td className='coltitle' colSpan="5">!!這是A班最後一筆資料了!!</td>
                </tr>
              </tfoot>
            </table>

              {/* B班 */}
              <div className='classtitle'>B班</div>
              <table className='table table-border'>
                <thead>
                  <tr>
                    <th className='coltitle'>🏆 Rank</th>
                    <th className='coltitle'>👦 Name 👩</th>
                    <th className='coltitle'>✨ 最新上線日期</th>
                    <th className='coltitle'>🎵 當日播放次數</th>
                    <th className='coltitle'>🎧 本月累積次數</th>
                  </tr>
                </thead>
              <tbody>
              {
                  this.state.studentsB &&
                  this.state.studentsB.map((studentsB, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center'>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>
                            {index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}
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
                                  <span className={studentsB.onlinetime?'text-success' || '':'text-danger'}>
                                    {studentsB.onlinetime || '近期無上線'}
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsB.index}>
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
                        </td>
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
                  <td className='coltitle' colSpan="5">!!這是B班最後一筆資料了!!</td>
                </tr>
              </tfoot>
            </table>

              {/* C班 */}
              <div className='classtitle'>C班</div>
              <table className='table table-border'>
                <thead>
                  <tr>
                    <th className='coltitle'>🏆 Rank</th>
                    <th className='coltitle'>👦 Name 👩</th>
                    <th className='coltitle'>✨ 最新上線日期</th>
                    <th className='coltitle'>🎵 當日播放次數</th>
                    <th className='coltitle'>🎧 本月累積次數</th>
                  </tr>
                </thead>
              <tbody>
              {
                  this.state.studentsC &&
                  this.state.studentsC.map((studentsC, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center'>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>
                            {index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}
                          </b>
                        </td>
                        <td key={studentsC.name}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b><span className='font-weight-bold'>{studentsC.name}</span></b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsC.onlinetime}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold'>
                                  <span className={studentsC.onlinetime?'text-success' || '':'text-danger'}>
                                    {studentsC.onlinetime || '近期無上線'}
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsC.index}>
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
                        </td>
                        <td key={studentsC.totaltimeplayed}>
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
                  <td className='coltitle' colSpan="5">!!這是C班最後一筆資料了!!</td>
                </tr>
              </tfoot>
              </table>

              {/* D班 */}
              <div className='classtitle'>D班</div>
              <table className='table table-border'>
                <thead>
                  <tr>
                    <th className='coltitle'>🏆 Rank</th>
                    <th className='coltitle'>👦 Name 👩</th>
                    <th className='coltitle'>✨ 最新上線日期</th>
                    <th className='coltitle'>🎵 當日播放次數</th>
                    <th className='coltitle'>🎧 本月累積次數</th>
                  </tr>
                </thead>
              <tbody>
              {
                  this.state.studentsD &&
                  this.state.studentsD.map((studentsD, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center'>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>
                            {index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}
                          </b>
                        </td>
                        <td key={studentsD.name}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b><span className='font-weight-bold'>{studentsD.name}</span></b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsD.onlinetime}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold'>
                                  <span className={studentsD.onlinetime?'text-success' || '':'text-danger'}>
                                    {studentsD.onlinetime || '近期無上線'}
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={studentsD.index}>
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
                        </td>
                        <td key={studentsD.totaltimeplayed}>
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
                  <td className='coltitle' colSpan="5">!!這是D班最後一筆資料了!!</td>
                </tr>
              </tfoot>
              </table>
          </div>            
      </Containerfull>
      )
  }
}

export default Leaderboard