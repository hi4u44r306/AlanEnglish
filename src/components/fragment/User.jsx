import React, {useState, useEffect} from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';
import HashLoader from "react-spinners/HashLoader";

const User = (user) => {

    const [loading, setLoading] = useState(false);
        
    useEffect(()=>{
        setLoading(true)
        setTimeout(() =>{
            setLoading(false);
        }, 2000)
    }, [])
    const db = firebase.firestore();
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
                const username = document.getElementById("username")
                username.textContent = doc.data().name;
                const useremail = document.getElementById("useremail")
                useremail.textContent = doc.data().email;
                const userclass = document.getElementById("userclass")
                userclass.textContent = doc.data().class;
            })
        }else{

        }
    }    
   
  return (
    <div className={"User"}>
        <div className="User-profile">
        {
                loading ?
                    (
                        <HashLoader 
                        color={"#2279ff"} 
                        loading={loading} 
                        size={150} 
                        />)
                                :
                                (
            <div className="User-profileDetails">
                <h3 className='mx-auto User-profile-title'>學生資料</h3>
                    <form>
                        <div className="d-flex md-3 mx-auto border border-primary userinfo">
                            <label>姓名:</label>
                            <p id="username">{user.name}</p>
                        </div>
                        <div className="d-flex md-3 mx-auto  border border-primary userinfo">
                            <label>Email:</label>
                            <p id="useremail">{user.email}</p>
                        </div>
                        <div className="d-flex md-3 mx-auto border border-primary userinfo">                                            
                            <label>班別:</label>
                            <p id="userclass">{user.class}</p>
                        </div>
                </form>
            </div>
            )
        }
        </div>
    </div>

  )
}

export default User