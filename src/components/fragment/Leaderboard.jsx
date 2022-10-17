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
            <div className='coltitle'>
              <div style={{width:'28%'}}>🏆 Rank</div>
              <div style={{width:'30%'}}>👦 Name 👩</div>
              <div style={{width:'35%'}}>🎧 Times</div>
              <div style={{width:'35%'}}>✨ 最後上線日、當日次數</div>
            </div>
            <table className='table table-border'>
              <tbody>
                <tr>
                  <th scope="col" style={{width:'23%'}}></th>
                  <th scope="col" style={{width:'22%'}}></th>
                  <th scope="col" style={{width:'30%'}}></th>
                  <th scope="col" style={{width:'31%'}}></th>
                </tr>
              {
                  this.state.students &&
                  this.state.students.map((students, index) =>{
                    return(
                      <tr key={index}>
                        <td className='d-flex justify-content-center' key={index}>
                          <b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>{index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}</b>
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
                              <b><span className='font-weight-bold' >{students.totaltimeplayed}次</span></b>
                            </div>
                          </div>
                        </td>
                        <td key={students.onlinetime}>
                          <div className='d-flex justify-content-center'>
                            <div className="align-self-center pl-3">
                              <b>
                                <span className='font-weight-bold' >
                                  <span>
                                    {students.onlinetime || '近期無上線'}
                                  </span>
                                  <span>
                                     / 
                                  </span>
                                  <span>
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
            </table>
          </div>            
      </Containerfull>
      )
  }
}

export default Leaderboard