import React from "react";
// import HeadPhone from '../assets/img/headphones.svg';
// import HeadPhone from '../assets/img/User-Image1.png';
import HeadPhone from '../assets/img/Login2.png';
import './css/Login.scss';
import firebase from "./firebase";
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
    
    // success = (userCredential) =>  {
    //     toast.success('😻Welcome😻',{
    //         className:"notification",
    //         position: "top-center",
    //         autoClose: 500,
    //         hideProgressBar: false,
    //         closeOnClick: true,
    //         pauseOnHover: false,
    //         draggable: true,
    //         progress: undefined,
    //         theme: "colored",
    //         });
    //         setTimeout(function(){window.location = "/home/leaderboard";} ,500); 
            
    //     };

    error = () =>  {
        toast.error('帳號密碼錯誤 🤯',{
            className:"notification",
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "colored",
            });
        };
    expire = () =>  {
        toast.error('此帳號已註銷',{
            className:"notification",
            position: "top-center",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "colored",
            });
        };

    login(e){
        // function subtractDays(numOfDays, date = new Date()) {
        //     const dateCopy = new Date(date.getTime());
        //     dateCopy.setDate(dateCopy.getDate() - numOfDays);
        //     return dateCopy;
        // }
        
        // const date = new Date('2022-11-07');
        // const result = subtractDays(7, date);
        // const calculateaccountexpiretime = result.toJSON().slice(0,10)
        e.preventDefault();
        firebase.auth().signInWithEmailAndPassword(this.state.email,this.state.password)
        .then((userCredential)=>{
            // 檢查次帳號試用期是否已到 //
            // firebase.firestore().collection('student').doc(userCredential.user.uid).get().then((doc)=>{
            //     if(doc.data().accountcreatetime === calculateaccountexpiretime){
            //         this.expire();
            //     }else{
            //         this.success();
            //     }
            // })
            firebase.firestore().collection('student').doc(userCredential.user.uid).get().then((doc)=>{
                const resolveAfter1SecSuccess = new Promise(resolve => setTimeout(resolve, 2000));
                toast.promise(
                    resolveAfter1SecSuccess,
                    {
                        pending: {
                            render(){
                              return "Loading...";
                            },
                          },
                        success:{
                            render(){
                                return <div className="notification">Welcome Back {doc.data().name.toUpperCase()}!!</div>
                            },
                            
                        }
                    },
                    setTimeout(function(){window.location = "/home/leaderboard";},2500) 
                );
            })
            

            
            
        }).catch(()=>{
            const resolveAfter3Sec = new Promise((resolve, reject) =>{
                setTimeout(reject, 2500);
            });
            toast.promise(resolveAfter3Sec,{
                pending: 'Loading...',
                success: 'Promise resolved 👌',
                error:{
                    render(){
                        return <div className="notification">帳號密碼錯誤 🤯</div>
                    }
                }
            })
            // toast.promise('帳號密碼錯誤 🤯',{
            //     className:"notification",
            //     position: "top-center",
            //     autoClose: 3000,
            //     hideProgressBar: false,
            //     closeOnClick: true,
            //     pauseOnHover: false,
            //     draggable: true,
            //     progress: undefined,
            //     theme: "colored",
            // });
        })
    }

    handleKeypress(e){
        //it triggers by pressing the enter key
      if (e.keyCode === 13) {
        this.btn.click();
      }
    };

    handleChange(e){
        this.setState({
            [e.target.name] : e.target.value
        })
    }
    
    render() {
        return(
            <section className="Login">
                    <div className="Logincontainer">
                        <div className="Left">
                            <div className="english-method">
                                <p>步驟一：能聽清楚句子中每個單字,並瞭解中文句意。</p>
                                <p>步驟二：聽問句與提示後,能馬上完整地回答！回答速度可以比MP3更快！</p>
                                <p>步驟三：只唸幾次所強記的單字忘得快!!!!所以，依學生個別的專注能力，前兩個步驟需要 20～80 次反覆地聽讀跟唸,
                                    才能有效地背誦並牢記單字！
                                </p>
                            </div>
                            <img className="head-phone-img" src={HeadPhone} alt=""/>
                        </div>
                       
                        <div className="Right">
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
                                    <div className="loginbrandbottomtext">系統化 | 口語化 | 聽力導向 </div>
                                </div>
                            </div>
                            <div className="loginsection">
                                
                                <label>帳號</label>
                                <input
                                    className="rightinput"
                                    name="email" 
                                    type="email" 
                                    id="email" 
                                    placeholder="輸入電子郵件或帳號..." 
                                    onChange={this.handleChange} 
                                    onKeyPress={this.handleKeypress}
                                    value={this.state.email}
                                    />

                                <label>密碼</label>
                                    <input 
                                        className="rightinput"
                                        name="password"
                                        type="password" 
                                        id="password" 
                                        placeholder="輸入密碼..." 
                                        onChange={this.handleChange} 
                                        onKeyPress={this.handleKeypress}
                                        value={this.state.password}
                                    />

                                <button 
                                    onClick={this.login} 
                                    className="loginbtn" 
                                    ref={node => (this.btn = node)} 
                                    type="submit"
                                >
                                    登入
                                </button>
                                <ToastContainer
                                position="top-center"
                                autoClose={2000}
                                limit={1}
                                hideProgressBar={false}
                                newestOnTop={false}
                                closeOnClick
                                rtl={false}
                                pauseOnFocusLoss
                                draggable
                                pauseOnHover
                                />
                                <div className="logincopyrightcontainer">
                                    <span className="logincopyright" href="/">© 2022 Alan English Inc.</span>
                                </div>
                            </div>
                            
                          
                        </div>
                        
                    </div>
                    
            </section>
        );
    }
}

export default Login;