import React from 'react'
// import { Link } from 'react-router-dom'
import './css/Edit.scss';
import firebase from "./firebase";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ScaleLoader from "react-spinners/ScaleLoader";


class Edit extends React.Component {

    constructor(props) {
        super(props)
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            loading: true,
            class: "",
            name: "",
            totaltimeplayed: "",
        }
    }
    // useruid = localStorage.getItem('ae-useruid');
    dbRef = firebase.database().ref();
    db = firebase.firestore();

    componentDidMount() {
        // get url's userid //
        const url = window.location.pathname;
        const segments = url.split('/');
        const useruid = segments[segments.length - 1] || segments[segments.length - 2];

        this.db.collection("student").doc(useruid).get().then((doc) => {
            this.setState({ ...doc.data() })
        }).catch(() => {
            this.setState({})
        });
        setTimeout(() => {
            this.setState({ loading: false });
        }, 1000);
        // this.dbRef.child("Users").child(this.useruid).get().then((snapshot) => {
        //     this.setState({ ...snapshot.val() })
        // }).catch(() => {
        //     this.setState({})
        // });
        // setTimeout(() => {
        //     this.setState({ loading: false });
        // }, 1000);
    }

    success = () => {
        toast.success('修改成功', {
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "light",
        });
        setTimeout(() => { window.location.href = "/home/dashboard"; }, 1000)
    };

    error = () => {
        toast.error('帳號密碼錯誤', {
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "light",
        });
    }

    update = () => {
        console.log('success')
        // this.dbRef.child("Users").child(this.useruid).update({
        //     studentname: this.state.studentname,
        //     parentsname: this.state.parentsname,
        //     phonenumber: this.state.phonenumber,
        // }).then(() => {
        //     localStorage.setItem("studentname", this.state.studentname);
        //     localStorage.setItem("parentsname", this.state.parentsname);
        //     localStorage.setItem('phonenumber', this.state.phonenumber)
        //     this.success();
        //     setTimeout(() => {
        //         window.location.href = "/home/dashboard"
        //     }, 1000);
        // }).catch(() => {
        //     this.error();
        // })
    }

    cancel = () => {
        window.location.href = "/home/dashboard"
    }

    handleChange(e) {
        this.setState({
            [e.target.name]: e.target.value
        })
    }

    render() {
        return (
            <div className='Editcontainer'>
                <ToastContainer />
                <div className='Editform'>
                    <div className='Editinputcontainer'>
                        <label>班級 / Class</label>
                        {
                            this.state.loading ?
                                <ScaleLoader
                                    loading={this.loading}
                                    color="hsla(209, 100%, 69%, 1)"
                                    height={25}
                                />
                                :
                                <input name='class' value={this.state.class} onChange={this.handleChange} />
                        }
                    </div>
                    <div className='Editinputcontainer'>
                        <label>學生名稱 / Student Name</label>
                        {
                            this.state.loading ?
                                <ScaleLoader
                                    loading={this.loading}
                                    color="hsla(209, 100%, 69%, 1)"
                                    height={25}
                                />
                                :
                                <input name='name' value={this.state.name} onChange={this.handleChange} />
                        }
                    </div>
                    <div className='Editinputcontainer'>
                        <label>播放次數 / Totaltimeplayed</label>
                        {
                            this.state.loading ?
                                <ScaleLoader
                                    loading={this.loading}
                                    color="hsla(209, 100%, 69%, 1)"
                                    height={25}
                                />
                                :
                                <input name='totaltimeplayed' value={this.state.totaltimeplayed} onChange={this.handleChange} />
                        }

                    </div>
                    <div className='Editbtn'>
                        <button className="updatebtn"
                            onClick={this.update}
                            type="submit">更新資料</button>
                    </div>
                    <div className='Editbtn'>
                        <button className="cancelbtn"
                            onClick={this.cancel}
                            type="submit">取消</button>
                    </div>
                </div>
            </div>
        );
    }
}

export default Edit;
