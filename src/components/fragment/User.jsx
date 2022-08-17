import React from 'react';
import firebase from 'firebase/app';
import 'firebase/firestore';
import '../assets/scss/User.scss';

const User = (user) => {

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
                document.getElementById("username").innerHTML = doc.data().name;
                document.getElementById("useremail").innerHTML = doc.data().email;
                document.getElementById("userclass").innerHTML = doc.data().class;
            })
        }else{

        }
    }    
   
  return (
    <div className={"User"}>
            <div className="User-profile">
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
            </div>
        </div>
  )
}

export default User