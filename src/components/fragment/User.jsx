import React, { useState } from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';
import Logout from './Logout'
// import HashLoader from "react-spinners/HashLoader";
// import UserImage1 from "../assets/img/User-Image1.png";
// import UserImage2 from "../assets/img/Login.png";
import { buildStyles, CircularProgressbarWithChildren } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Star from '../assets/img/star.png';
import Notice from '../assets/img/warning.png';
import { toast, ToastContainer } from "react-toastify"
import { useEffect } from 'react';


const User = () => {

    const db = firebase.firestore();
    const username = localStorage.getItem('ae-username');
    const totaltimeplayed = localStorage.getItem('ae-totaltimeplayed');
    const useruid = localStorage.getItem('ae-useruid');
    const [dailytimeplayed, setDailyTimeplayed] = useState();
    const currentDate = new Date().toJSON().slice(0, 10);
    const currentMonth = new Date().toJSON().slice(0, 7);
    const custompathColor = `#89aae6`
    const percentage = dailytimeplayed * 100 / 20;



    const error = () => {
        toast.error('尚未登入 即將跳轉至登入頁面', {
            className: "notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
        });
        setTimeout(() => {
            window.location.href = '/'
        }, 1200);
    };

    useEffect(() => {
        db.collection('student').doc(useruid).get().then((doc) => {
            setDailyTimeplayed(doc.data().currdatetimeplayed);
        }).catch(() => {
            setDailyTimeplayed("0")
        })

        firebase.auth().onAuthStateChanged(user => {
            if (!user) return error();
        })
    }, [currentDate, currentMonth, db, useruid])

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
                                <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}> X {dailytimeplayed || '0'} </div>
                            </CircularProgressbarWithChildren>
                        </div>
                        <div className='abc'>
                            <div className='dailycircletext'>
                                <div className={dailytimeplayed >= 20 ? 'dailycircletext1' : ''}>{dailytimeplayed || '0'} </div>
                                <div className='dailycircletext2'>/ 20 次</div>
                            </div>
                            <div className='dailycircletext'>
                                <div className={dailytimeplayed >= 20 ? "complete" : 'notcomplete'}>達成目標!!!</div>
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
                    <Logout />

                    <ToastContainer
                        position="top-center"
                        autoClose={2000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />
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