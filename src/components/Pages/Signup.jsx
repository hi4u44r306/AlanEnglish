import React from "react";
import './css/Login.scss';
import firebase from "./firebase";
import { toast, ToastContainer} from "react-toastify"
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
        toast.success('創建成功',{
            className:"notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    error = () =>  {
        toast.error('失敗',{
            className:"notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };
    test = () => {
        for(let i=0; i<10;i++){
            let j = "'"+i+"'"
            console.log(j);
        }
    }

    signupuser(e){
        e.preventDefault();
        firebase.auth().createUserWithEmailAndPassword(this.state.email,this.state.password).then((Credentials)=>{ 
            const useruid = Credentials.user.uid; 
            const db = firebase.firestore();
            db.collection('student').doc(useruid).set({ // 設定名稱,Email,classtype
                name : this.state.name,
                class : this.state.classtype,
                email: this.state.email,
                totaltimeplayed : 0,
            })
            for(let i=0; i<2000;i++){
                let j = "'"+i+"'"
                db.collection('student').doc(useruid).collection('Musics').doc(j).set({ // 在特定User中加入Musics集合，在Musics中加入id以及timeplayed
                    timeplayed : 0,
                })
            }
            
            this.success();
            this.clear();
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
                                <span>Add User</span>
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
                                    創建
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

export default Signup;