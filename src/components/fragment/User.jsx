import React, {useState} from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';
// import HashLoader from "react-spinners/HashLoader";
// import UserImage1 from "../assets/img/User-Image1.png";
// import UserImage2 from "../assets/img/Login.png";
import { buildStyles, CircularProgressbarWithChildren } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Star from '../assets/img/star.png';
import Notice from '../assets/img/warning.png'; 
import Redirectpage from './Redirectpage';


const User = () => {

    const db = firebase.firestore();
    const [username, setUsername] = useState();
    const [auth, setAuth] = useState(false);
    const [dailytimeplayed, setDailyTimeplayed] = useState();
    const [totaltimeplayed, setTotaltimeplayed] = useState();
    const currentDate = new Date().toJSON().slice(0, 10);
    const currentMonth = new Date().toJSON().slice(0, 7);
    const custompathColor = `#89aae6`
    const percentage = dailytimeplayed*100/20;
    
    const getUserInfo = (user) =>{
        if(user){
            db.collection('student').doc(user.uid).get().then( doc => {
                setUsername(doc.data().name);
                setTotaltimeplayed(doc.data().totaltimeplayed);
            }).catch(()=>{
                setTotaltimeplayed(0);
            })
            db.collection('student').doc(user.uid).collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate).get().then((doc)=>{
                setDailyTimeplayed(doc.data().todaytotaltimeplayed);
            }).catch(()=>{
                setDailyTimeplayed("0")
            })
        }else{
            
        }
    }    
    
    firebase.auth().onAuthStateChanged(user => {
        if(user){
            db.collection('student').onSnapshot(() =>{
                getUserInfo(user);
                setAuth(true);
            }, () =>{
                // console.log(err.message);
            });
        }else{
            getUserInfo();
            setAuth(false);
        }
    })
    

    // const weekday = new Date(currentDate).getDay();
    // const weekdayarray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // console.log(weekdayarray[weekday]);

    if(!auth) return <Redirectpage/>
  return (
      <div className={"User"}>
        <div className="User-profile">
            <div className="User-profileDetails">
                <div className='User-profile-title'>
                    Profile
                </div>
                <div className='User-profile-today'>Today : {currentDate}</div>
                <div className='dailycirclecontainer'>
                <span className='howtouseicon'>
                        <img
                        style={{ width: 30, marginTop: -5 }}
                        src={Notice}
                        alt="notice"
                        />
                    <span className='howtouseicontext'>每天至少聽20次，聽一次加一顆星</span>
                </span>
                    <div className='currentdaycircle'>
                        <CircularProgressbarWithChildren value={percentage || 'Loading...'} 
                            styles={buildStyles({
                                textColor: "red",
                                pathColor: "gold",
                                trailColor: `${custompathColor}`
                                })}
                            >
                            <img
                            style={{ width: 40, marginTop: -5 }}
                            src={Star}
                            alt="star"
                            />
                            <div className={dailytimeplayed >= 20?'dailycircletext1':''}> X {dailytimeplayed || '0'} </div>
                        </CircularProgressbarWithChildren>
                    </div>
                    <div className='abc'>
                        <div className='dailycircletext'>
                            <div className={dailytimeplayed >= 20?'dailycircletext1':''}>{dailytimeplayed || '0'} </div>
                            <div className='dailycircletext2'>/ 20 次</div>
                        </div>
                        <div className='dailycircletext'>
                            <div className={dailytimeplayed >= 20?"complete":'notcomplete'}>達成目標!!!</div>
                        </div>
                    </div>
                </div>
                <div className='userinfocontainer'>
                    <div className="userinfo">
                        <label>👦 姓名:</label>
                        <p className='userinfoptag'>{username || 'Loading...'}</p>
                    </div>
                    <div className="userinfo">
                        <label>🏆 本月聽力總次數:</label>
                        <p className='userinfoptag'>{totaltimeplayed || '0'}次</p>
                    </div>
                </div>
                {/* <div>Days Learned</div> */}
                {/* <div className='dailycirclecontainer'>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                    <div className='dailycircletext'>Mon</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Tue</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Wed</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Thur</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Fri</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Sat</div>
                    </div>
                    <div className='dailycircle'>
                        <CircularProgressbar
                            value={percentage || ''}
                            text={`${percentage || '0'}%`}
                            styles={buildStyles({
                            textColor: "red",
                            pathColor: {custompathColor},
                            trailColor: "gold"
                            })}
                        />
                        <div className='dailycircletext'>Sun</div>
                    </div>
                    
                </div> */}
                {/* <form>
                    <div className="userinfo">
                        <label>👦👧 姓名:</label>
                        <p>{username || 'Loading'}</p>
                    </div>
                    <div className="userinfo">
                        <label>🎧 {currentDate} 聽力次數:</label>
                        <p>{dailytimeplayed || '0'}次</p>
                    </div>
                    <div className="userinfo">
                        <label>🏆 總聽力次數:</label>
                        <p>{totaltimeplayed || '0'}次</p>
                    </div>
                </form> */}
            </div>
        </div>
    </div>

  )
}

export default User