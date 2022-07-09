import { Component } from "react";
import fire from "./config/fire";
import './Login.css';

class Login extends Component{
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
            console.log(u)
        }).catch((err)=>{
            console.log(err)
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

    render(){
        return(
            <div>
                <div className="logo">
                    Alan English
                </div>
                
                <form>
                    <h1>Alan English</h1>
                    <div className="input-group">
                        <label>帳號</label>
                        <input
                        name="email" 
                        type="email" 
                        id="email" 
                        placeholder="enter email address" 
                        onChange={this.handleChange} 
                        value={this.state.email}
                        />
                    </div>

                    <div className="input-group">
                        <label>密碼</label>
                        <input 
                        name="password"
                        type="password" 
                        id="password" 
                        placeholder="enter password" 
                        onChange={this.handleChange} 
                        value={this.state.password}
                        />
                    </div>
                    
                    <div className="btn-group">
                        <button className="btn" onClick={this.login}>登入</button>
                    </div>
                </form>
            </div>
        )
    }
}

export default Login;