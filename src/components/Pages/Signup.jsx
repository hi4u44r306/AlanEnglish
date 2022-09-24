import React from "react";
import './css/Login.scss';
import firebase from "./firebase";
import db from './firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

class Signup extends React.Component{

    constructor(props)
    {
        super(props)
        this.signupuser = this.signupuser.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.state={
            email:"",
            password:"",
            name : "",
            classtype: "",
        }
    }
    
    success = () =>  {
        // toast.success('創建成功',{
        //     className:"notification",
        //     position: "top-center",
        //     autoClose: 1000,
        //     hideProgressBar: false,
        //     closeOnClick: true,
        //     pauseOnHover: false,
        //     draggable: true,
        //     progress: undefined,
        //     });
        alert("成功")
        };

    error = () =>  {
        // toast.error('有些地方錯誤',{
        //     className:"notification",
        //     position: "top-center",
        //     autoClose: 3000,
        //     hideProgressBar: false,
        //     closeOnClick: true,
        //     pauseOnHover: false,
        //     draggable: true,
        //     progress: undefined,
        //     });
        alert('error')
        };

    // signupuser(e){
    //     e.preventDefault();
    //     firebase.auth().createUserWithEmailAndPassword(this.state.email,this.state.password)
    //     .then(()=>{
    //         this.success();
            
    //     }).catch(()=>{
    //         this.error();
    //     })
    // }
    // const ref = firebase.database().ref();
    // ref.on('value', function (snapshot) {
    //     document.getElementById('content').textContent = JSON.stringify(snapshot.val(), null, 3);
    // })


    signupuser(e){
        e.preventDefault();
        firebase.auth().createUserWithEmailAndPassword(this.state.email,this.state.password).then((Credentials)=>{ 
            const useruid = Credentials.user.uid; 

            const db = firebase.firestore();

            db.collection('student').doc(useruid).set({
                name : this.state.name,
                class : this.state.classtype,
                email: this.state.email,
            })
            this.success();

        }).catch(()=>{
            this.error();
        });
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
                        <div className="main-row-text">
                            <div className="loginsection">
                                <div className="loginbrand">
                                    <div className="loginbrandword">
                                        <span>Add User</span>
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

                                <label>English Name</label>
                                    <input 
                                        name="name"
                                        type="name" 
                                        id="name" 
                                        placeholder="輸入姓名..." 
                                        onChange={this.handleChange} 
                                        value={this.state.name}
                                    />

                                 <label>ClassType</label>
                                    <input 
                                        name="classtype"
                                        type="classtype" 
                                        id="classtype" 
                                        placeholder="輸入Class..." 
                                        onChange={this.handleChange} 
                                        value={this.state.classtype} 
                                    />
                                       
                                
                                <button onClick={this.signupuser} className="loginbtn">
                                    創建User
                                    {/* <ToastContainer
                                    position="top-center"
                                    autoClose={2000}
                                    hideProgressBar={false}
                                    newestOnTop={false}
                                    closeOnClick
                                    rtl={false}
                                    pauseOnFocusLoss
                                    draggable
                                    pauseOnHover
                                    /> */}
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

export default Signup;