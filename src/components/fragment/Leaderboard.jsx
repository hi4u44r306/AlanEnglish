import React from 'react'
import '../assets/scss/Leaderboard.scss';
import firebase from 'firebase/app';
import loudspeaker from '../assets/img/loudspeaker.png'

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
                  <div className='prize'>
                    <div>🥇第一名 : 麥當勞</div>
                    <div>🥈第二名 : 薯條一份</div>
                    <div>🥉第三名 : 飲料一杯</div>
                  </div>  
                <table className='table table-borderless'>
                  <col style={{width:'30%'}}/>
                  <col style={{width:'30%'}}/>
                  <col style={{width:'40%'}}/>
                  {/* <col style={{width:'20%'}}/> */}
                  <thead>
                    <tr className='coltitle'>
                      <th scope="col">🏆Rank</th>
                      <th scope="col">👦👩Name</th>
                      <th scope="col">🎧Timeplayed</th>
                      {/* <th scope="col">Time Online</th> */}
                    </tr>
                  </thead>
                  <tbody>
                  {
                      this.state.students &&
                      this.state.students.map((students, index) =>{
                        return(
                          <tr>
                            <td className='border-0'><b className={index + 1===1 || index + 1===2 || index + 1===3?'text-danger':''}>{index + 1===1?'🥇1st': index+1===2?'🥈2nd': index+1===3?'🥉3rd': index+1}</b></td>
                            <td className='border-0'>
                              <div className='d-flex'>
                                <div className="align-self-center pl-3">
                                  <b><span className='font-weight-bold'>{students.name}</span></b>
                                </div>
                              </div>
                            </td>
                            <td>
                              <b>
                              {students.totaltimeplayed}次
                              </b>
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