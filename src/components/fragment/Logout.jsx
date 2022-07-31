import React from "react";
import "../assets/scss/Brand.scss";
import fire from "../Pages/fire";

class Logout extends React.Component {
    constructor(props)
    {
        super(props)
        this.state={

        }
    }
    logout(){
        fire.auth().signOut()
        .then((u)=>{
            console.log(u);
            window.location = "/";
        }).catch((err)=>{
            console.log(err)
        })
    }
    render() {
        return (
                <button className="logoutbtn" onClick={this.logout}>Logout</button>
        );
    }
}

export default Logout;