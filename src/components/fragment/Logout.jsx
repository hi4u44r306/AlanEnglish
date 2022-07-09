import React from "react";
import {Link} from "react-router-dom";
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
            <div className={"brand"}>
                {/* <Link onClick={this.logout}>
                    <h1>
                        Logout
                    </h1>
                </Link> */}
                 <div className="btn-group">
                    <button className="btn" onClick={this.logout}>登出</button>
                </div>
            </div>
        );
    }
}

export default Logout;