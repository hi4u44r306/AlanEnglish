import React, {useEffect, useState} from 'react';
import firebase from 'firebase';

const User = () => {

    const db = firebase.firestore();
    const [currentuser, setcurrentUser] = useState();

    useEffect(() => {
        firebase.auth().onAuthStateChanged((user) => {
          setcurrentUser(user)
        })
    },[])

    db.collection('student').get().then((snapshot)=>{
        snapshot.docs.forEach(doc => {
            console.log(doc.data())
        })
    })
   
  return (
    <div className={"Contact"}>
            <div className="Contact-profile">
                <div className="Contact-profileDetails">
                <h3 className='mx-auto'>學生資料</h3>
                    <form>
                            <div className="d-flex md-3 mx-auto border border-primary input-field">
                                {currentuser &&<p>姓名{currentuser.displayName} </p>}
                            </div>
                            <div className="d-flex md-3 mx-auto  border border-primary input-field">
                                {currentuser &&<label>Email :{currentuser.email} </label>}
                            </div>
                            <div className="d-flex md-3 mx-auto border border-primary input-field">
                                {currentuser &&<p>班別{currentuser.displayName} </p>}
                            </div>
                    </form>
                </div>
            </div>
        </div>
  )
}

export default User