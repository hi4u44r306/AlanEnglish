import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
import loudspeaker from '../assets/img/loudspeaker.png'
import CountdownTimer from './CountdownTimer';
import Container from './Container';

class Leaderboard extends React.Component{

  
  state ={
    students:null,
  }
  
  
  componentDidMount() {
    const db = firebase.firestore();
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
      <Container>
          <div className='leaderboard'>
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
                10月31日結算  
              </div>
              <CountdownTimer countdownTimestampMs={1667231999000}/>  {/* 到期日10/31 */}
            </div>
            <div className='prize'>
              <div>前十名獎品待定</div>
            </div>  
            <div className='coltitle'>
              <div style={{width:'35%'}}>🏆 Rank</div>
              <div style={{width:'40%'}}>👦 Name 👩</div>
              <div style={{width:'35%'}}>🎧 Timeplayed</div>
            </div>
            <table className='table table-borderless'>
              <tbody>
                <th scope="col" style={{width:'35%'}}></th>
                <th scope="col" style={{width:'31%'}}></th>
                <th scope="col" style={{width:'35%'}}></th>
              {
                  this.state.students &&
                  this.state.students.map((students, index) =>{
                    return(
                      <tr>
                        <td className='border-0 d-flex justify-content-center' key={index}><b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>{index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}</b></td>
                        <td className='border-0' key={students.name}>
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
                      </tr>
                      )
                    })
                  }
              </tbody>
            </table>
          </div>            
      </Container>
      )
  }
}

export default Leaderboard