import React from "react";
// import HeadPhone from '../assets/img/headphones.svg';
// import HeadPhone from '../assets/img/User-Image1.png';
import HeadPhone from '../assets/img/Login2.png';
import './css/Login.scss';
import fire from "./fire";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
    
    success = () =>  {
        toast.success('😻Welcome😻',{
            className:"notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
            setTimeout(function(){window.location = "/home";} , 1200); 
            
        };

    error = () =>  {
        toast.error('🙀帳號密碼錯誤🙀',{
            className:"notification",
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    login(e){
        e.preventDefault();
        fire.auth().signInWithEmailAndPassword(this.state.email,this.state.password)
        .then(()=>{
            this.success();
            
        }).catch(()=>{
            this.error();
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
                            <div className="loginsection">
                                <div className="loginbrand">
                                    <div className="loginbrandword">
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
                                    <div className="loginbrandbottom">
                                        <p>系統化 | 口語化 | 聽力導向 </p>
                                    </div>
                                </div>
                                
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

                                <button onClick={this.login} className="loginbtn">
                                    登入
                                    <ToastContainer
                                    position="top-center"
                                    autoClose={2000}
                                    hideProgressBar={false}
                                    newestOnTop={false}
                                    closeOnClick
                                    rtl={false}
                                    pauseOnFocusLoss
                                    draggable
                                    pauseOnHover
                                    />
                                </button>
                                <div className="nav-item">
                                    <span className="logincopyright" href="/">Copyright © 2022 Alan English Inc.</span>
                                </div>
                            </div>
                            
                          
                        </div>
                        
                    </div>
                    
            </section>
        );
    }
}

export default Login;