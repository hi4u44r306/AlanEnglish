import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
import loudspeaker from '../assets/img/loudspeaker.png'
import CountdownTimer from './CountdownTimer';

class Leaderboard extends React.Component{

  
  state ={
    students:null,
  }
  
  componentDidMount() {
    const db = firebase.firestore();
    db.collection("student").where("totaltimeplayed", ">", 0).orderBy('totaltimeplayed', 'desc').get().then((snapshot) => {
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
          <div className='leaderboard'>
            <div className='card'>
              <div className="score-body">
                  <div className='leaderboardtitle'>
                    <div>
                      <img className='loudspeaker1' src={loudspeaker} alt='#'/>
                    </div>
                    🎧播放次數排行榜🎧
                    <div>
                      <img className='loudspeaker2' src={loudspeaker} alt='#'/>
                    </div>
                  </div>
                  <div className='countdown'>
                    <div className='countdownlabel'>
                      播放總次數大於100才會上榜!! 10月結算倒數  
                    </div>
                    <CountdownTimer countdownTimestampMs={1667231999000}/>
                  </div>
                  <div className='prize'>
                    <div>前三名獎品</div>
                    <div>🥇 1st : 待定</div>
                    <div>🥈 2nd : 待定</div>
                    <div>🥉 3rd : 待定</div>
                  </div>  
                  <div className='coltitle'>
                    <div style={{width:'35%'}}>🏆 Rank</div>
                    <div style={{width:'40%'}}>👦 Name 👩</div>
                    <div style={{width:'35%'}}>🎧 Timeplayed</div>
                    {/* <th className='test' scope="col" style={{width:'30%'}}>🏆 Rank</th>
                    <th className='test' scope="col" style={{width:'35%'}}>👦 Name 👩</th>
                    <th className='test' scope="col" style={{width:'35%'}}>🎧 Timeplayed</th> */}
                    {/* <th scope="col" style={{width:'40%'}}>Time Online</th> */}
                  </div>
                <table className='table table-borderless'>
                  <thead>
                    <th scope="col" style={{width:'35%'}}></th>
                    <th scope="col" style={{width:'31%'}}></th>
                    <th scope="col" style={{width:'35%'}}></th>
                  </thead>
                  <tbody>
                  {
                      this.state.students &&
                      this.state.students.map((students, index) =>{
                        return(
                          <tr>
                            <td className='border-0 d-flex justify-content-center' key={index}><b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>{index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}</b></td>
                            <td className='border-0'>
                              <div className='d-flex justify-content-center'>
                                <div className="align-self-center pl-3">
                                  <b><span className='font-weight-bold' key={students.name}>{students.name}</span></b>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className='d-flex justify-content-center'>
                                <div className="align-self-center pl-3">
                                  <b><span className='font-weight-bold' key={students.totaltimeplayed}>{students.totaltimeplayed}次</span></b>
                                </div>
                              </div>
                              {/* <b key={students.totaltimeplayed}>
                              {students.totaltimeplayed}次
                              </b> */}
                            </td>
                          </tr>
                          )
                        })
                      }
                  </tbody>
                </table>
              </div>
            </div>
          </div>            
      )
  }
}

export default Leaderboard