import React from "react";
import "../assets/scss/Logout.scss";
import firebase from "../Pages/firebase";
// import Exiticon from "../assets/img/exit.png"
import Logouticon from "../assets/img/log-out.png"

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
                {/* <button className="logoutbtn" onClick={this.logout}>
                </button> */}
                <img className="logoutbtn" onClick={this.logout} src={Logouticon} alt="#"/>
            </div>
               
        );
    }
}

export default Logout;