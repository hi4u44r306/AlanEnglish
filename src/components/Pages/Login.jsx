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
            alert("帳號密碼錯誤請再輸入一次...")
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
                            
                            <div className="english-method">
                                <p>步驟一：能聽清楚句子中每個單字,並瞭解中文句意。</p>
                                <br/>
                                <p>步驟二：聽問句與提示後,能馬上完整地回答！回答速度可以比MP3更快！</p>
                                <br/>
                                <p>步驟三：只唸幾次所強記的單字忘得快!!!!所以，依學生個別的專注能力，前兩個步驟需要 20～80 次反覆地聽讀跟唸,
                                    才能有效地背誦並牢記單字！
                                </p>
                            </div>
                            <img className="head-phone-img" src={HeadPhone} alt=""/>
                        </div>
                       
                        <div className="main-row-text">
                            <div className="loginbrand">
                                <span>A</span>
                                <span>L</span>
                                <span>A</span>
                                <span>N</span>
                                <span> </span>
                                <span>E</span>
                                <span>N</span>
                                <span>G</span>
                                <span>L</span>
                                <span>I</span>
                                <span>S</span>
                                <span>H</span>
                            </div>
                            <p>系統化 | 口語化 | 聽力導向 </p>
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

                            <Link onClick={this.login} className="loginbtn">
                                登入
                            </Link>
                        </div>
                    </div>
            </section>
        );
    }
}

export default Login;