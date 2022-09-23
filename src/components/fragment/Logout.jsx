import React from "react";
import "../assets/scss/Logout.scss";
import firebase from "../Pages/firebase";

class Logout extends React.Component {
    constructor(props)
    {
        super(props)
        this.state={

        }
    }
    logout(){
        firebase.auth().signOut()
        .then((u)=>{
            console.log(u);
            window.location = "/";
        }).catch((err)=>{
            console.log(err)
        })
    }
    render() {
        return (
            <div className="logoutcontainer">
                 <button className="logoutbtn" onClick={this.logout}>登出</button>
            </div>
               
        );
    }
}

export default Logout;