import React from "react";
import HeadPhone from '../assets/img/headphones.svg';
import './css/Login.scss';
import {Link} from "react-router-dom";
import fire from "./fire";

class Login extends React.Component{
    constructor(props)
    {
        super(props)
        this.login = this.login.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.signup = this.signup.bind(this);
        this.state={
            email:"",
            password:""
        }
    }

    login(e){
        e.preventDefault();
        fire.auth().signInWithEmailAndPassword(this.state.email,this.state.password)
        .then((u)=>{
            console.log(u);
            window.location = "/home";
        }).catch((err)=>{
            console.log(err)
            alert("Email or Password incorrect")
        })
    }

    signup(e){
        e.preventDefault();
        fire.auth().createUserWithEmailAndPassword(this.state.email, this.state.password)
        .then((u) => {
            console.log(u)
        }).catch((err) =>{
            console.log(err);
        })
    }

    handleChange(e){
        this.setState({
            [e.target.name] : e.target.value
        })
    }
    render() {
        return(
            <section id="main">
                    <div className="nav-item">
                        <a className="navbar-brand" href="/">Alan English</a>
                    </div>
                    <div className="main-row">
                        <div className="main-row-img">
                            <img className="head-phone-img" src={HeadPhone} alt=""/>
                        </div>
                        <div className="main-row-text">
                            <h1>Alan English</h1>
                            <p>The Most Effective English Learning</p>
                            <label>帳號</label>
                            <input
                                name="email" 
                                type="email" 
                                id="email" 
                                placeholder="輸入電子郵件或帳號..." 
                                onChange={this.handleChange} 
                                value={this.state.email}
                                />

                            <label>密碼</label>
                                <input 
                                    name="password"
                                    type="password" 
                                    id="password" 
                                    placeholder="輸入密碼..." 
                                    onChange={this.handleChange} 
                                    value={this.state.password}
                                />

                            <Link onClick={this.login} className="btn">
                                登入
                            </Link>
                        </div>
                    </div>
            </section>
        );
    }
}

export default Login;