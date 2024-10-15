import React from "react";
import "./css/Logout.scss";
import { signOut } from "firebase/auth";
import { IoExit } from "react-icons/io5";
import { FONTS } from "./theme";
import { authentication } from "./firebase-config";
// import Exiticon from "../assets/img/exit.png"
// import Logouticon from "../assets/img/log-out.png"

class Logout extends React.Component {
    constructor(props) {
        super(props)
        this.state = {

        }
    }
    logout() {
        if (window.confirm('確定要登出嗎?')) {
            signOut(authentication)
                .then(() => {
                    localStorage.removeItem('ae-class');
                    localStorage.removeItem('ae-useruid');
                    localStorage.removeItem('ae-userimage');
                    localStorage.removeItem('ae-username');
                    localStorage.removeItem('ae-teacherschool');
                    // localStorage.removeItem('AllStudent');
                    // localStorage.removeItem('OnlineStudentData');
                    // localStorage.removeItem('OfflineStudentData');
                    window.location = "/";
                    alert('已成功登出');
                }).catch((err) => {
                    console.log(err)
                })
        } else {

        }
    }
    render() {
        return (
            <div className="logoutcontainer">
                <button className="logoutbtn" onClick={this.logout}>
                    <IoExit size={20} />
                    <span style={{
                        textAlign: 'center',
                        fontSize: '20px',
                        fontFamily: FONTS.semiBold,
                    }}>
                        登出
                    </span>
                </button>

                {/* <img className="logoutbtn" onClick={this.logout} src={Logouticon} alt="#"/> */}
            </div>

        );
    }
}

export default Logout;