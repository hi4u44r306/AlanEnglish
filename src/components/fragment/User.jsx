import React, {useState, useEffect} from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';
import HashLoader from "react-spinners/HashLoader";
import UserImage1 from "../assets/img/User-Image1.png";

const User = (user) => {

    const [loading, setLoading] = useState(false);
    const db = firebase.firestore();
    const [username, setUsername] = useState();
    const [useremail, setUseremail] = useState();
    const [userclass, setUserclass] = useState();


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
    
    const getUserInfo = (user) =>{
        if(user){
            db.collection('student').doc(user.uid).get().then( doc => {
                setUsername(doc.data().name);
                setUseremail(doc.data().email);
                setUserclass(doc.data().class);
            })
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
            <div className="User-profileDetails">
                <h3 className='User-profile-title'>學生資料</h3>
                    <form>
                        <div className="userinfo">
                            <label>姓名:</label>
                            <p>{username}</p>
                        </div>
                        <div className="userinfo">
                            <label>Email:</label>
                            <p>{useremail}</p>
                        </div>
                        <div className="userinfo">                                            
                            <label>班別:</label>
                            <p>{userclass}</p>
                        </div>
                </form>
            </div>
            )
        }
            <div className="User-Image">
                <img src={UserImage1} alt="Profile"/>
            </div>
        </div>
    </div>

  )
}

export default User