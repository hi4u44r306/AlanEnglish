import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
import loudspeaker from '../assets/img/loudspeaker.png'
import CountdownTimer from './CountdownTimer';
import Containerfull from './Containerfull';

class Leaderboard extends React.Component{

  
  state ={
    students:null,
  }
  
  
  componentDidMount() {
    const db = firebase.firestore(); /// 使用limit()可選擇顯示資料數量
    db.collection("student").where("totaltimeplayed", ">", 0).orderBy('totaltimeplayed', 'desc').limit(20).get().then((snapshot) => {
      const students = [];
      snapshot.forEach((doc)=>{
        const data = doc.data();
        students.push(data);
      })
      this.setState({students: students});
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
              🎧 播放次數排行榜 🎧
              <div>
                <img className='loudspeaker2' src={loudspeaker} alt='#'/>
              </div>
            </div>
            <div className='countdown'>
              <div className='countdownlabel'>
                10月31日結算  
              </div>
              <CountdownTimer countdownTimestampMs={1667231999000}/>  {/* 到期日10/31 */}
            </div>
            <div className='prize'>
              <div>前十名獎品待定</div>
            </div>  
            <table className='table table-border'>
              <thead>
                <tr>
                  <th className='coltitle'>🏆 Rank</th>
                  <th className='coltitle'>👦 Name 👩</th>
                  <th className='coltitle'>🎧 Times</th>
                  <th className='coltitle'>✨ 最後上線日</th>
                  <th className='coltitle'>✨ 當日次數</th>
                </tr>
              </thead>
              {/* <thead>
                <tr>
                  <th className='coltitle'><button className='button-64'>All</button></th>
                  <th className='coltitle'><button>A班</button></th>
                  <th className='coltitle'><button>B班</button></th>
                  <th className='coltitle'><button>C班</button></th>
                  <th className='coltitle'><button>D班</button></th>
                </tr>
              </thead> */}
              <tbody>
              {
                  this.state.students &&
                  this.state.students.map((students, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center'>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>
                            {index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}
                          </b>
                        </td>
                        <td key={students.name}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b><span className='font-weight-bold'>{students.name}</span></b>
                            </div>
                          </div>
                        </td>
                        <td key={students.totaltimeplayed}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >{students.totaltimeplayed}次</span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={students.onlinetime}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold'>
                                  <span className={students.onlinetime?'text-success' || '':'text-danger'}>
                                    {students.onlinetime || '近期無上線'}
                                  </span>
                                </span>
                              </b>
                            </div>
                          </div>
                        </td>
                        <td key={students.currdatetimeplayed}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >
                                  <span className={students.currdatetimeplayed?'text-success' || '':'text-danger'}>
                                    {students.currdatetimeplayed || '0'}次
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
                  <td className='coltitle' colSpan="5">!!這是最後一筆資料了!!</td>
                </tr>
              </tfoot>
            </table>
          </div>            
      </Containerfull>
      )
  }
}

export default Leaderboard