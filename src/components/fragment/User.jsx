import React, {useState, useEffect} from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';
import HashLoader from "react-spinners/HashLoader";
import UserImage1 from "../assets/img/User-Image1.png";
import UserImage2 from "../assets/img/Login.png";


const User = (user) => {

    const [loading, setLoading] = useState(false);
    const db = firebase.firestore();
    const [username, setUsername] = useState();
    const [dailytimeplayed, setDailyTimeplayed] = useState();
    const [totaltimeplayed, setTotaltimeplayed] = useState();
    const currentDate = new Date().toJSON().slice(0, 10);

    useEffect(()=>{
        setLoading(true)
        setTimeout(() =>{
            setLoading(false);
        }, 2000)
    }, [])

    
    firebase.auth().onAuthStateChanged(user => {
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                getUserInfo(user);
            }, err =>{
                console.log(err.message);
            });
        }else{
            getUserInfo();
        }
    })

    // const [state, setState] = useState();

    const getUserInfo = (user) =>{
        if(user){
            db.collection('student').doc(user.uid).get().then( doc => {
                setUsername(doc.data().name);
                setTotaltimeplayed(doc.data().totaltimeplayed);
            }).catch((err)=>{
                console.log(err);
            })

            db.collection('student').doc(user.uid).collection('Logfile').doc(currentDate).get().then((doc)=>{
                setDailyTimeplayed(doc.data().todaytotaltimeplayed)
            }).catch((err)=>{
                console.log(err);
            })
            // db.collection("student").doc(user.uid).collection('Logfile').limit(5).get().then((snapshot) => {
            //     const userdata = [];
            //     snapshot.forEach((doc)=>{
            //     const data = doc.data();
            //     userdata.push(data);
            //     })
            //     setState(state);
            // });
        }else{

        }
    }    
   
  return (
    <div className={"User"}>
        <div className="User-profile">
            <div className="User-Image">
                <img src={UserImage1} alt=""/>
            </div>
        {
        loading ?
            (
            <HashLoader 
            color={"#fc0303"} 
            loading={loading} 
            size={100} 
            />)
            :
            (
            <div className="d-flex">
                {/* <div className="User-profileDetails">
                    <h3 className='User-profile-title'>聽力紀錄</h3>
                    <form>
                        <div className="userinfo">
                            <label>🎧 </label>
                            <p>1000次</p>
                        </div>
                    </form>
                </div> */}
                <div className="User-profileDetails">
                    <h3 className='User-profile-title'>學生資料</h3>
                    <form>
                        <div className="userinfo">
                            <label>👦👧 姓名:</label>
                            <p>{username}</p>
                        </div>
                        <div className="userinfo">
                            <label>🎧 {currentDate} 聽力次數:</label>
                            <p>{dailytimeplayed}次</p>
                        </div>
                        <div className="userinfo">
                            <label>🏆 總聽力次數:</label>
                            <p>{totaltimeplayed}次</p>
                        </div>
                    </form>
                </div>
            </div>
            )
        }
            <div className="User-Image">
                <img src={UserImage2} alt="Profile"/>
            </div>
        </div>
    </div>

  )
}

export default User