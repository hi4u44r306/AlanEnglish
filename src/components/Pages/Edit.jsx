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
    url = window.location.pathname;
    segments = this.url.split('/');
    useruid = this.segments[this.segments.length - 1] || this.segments[this.segments.length - 2];

    componentDidMount() {
        this.db.collection("student").doc(this.useruid).get().then((doc) => {
            this.setState({ ...doc.data() })
        }).catch(() => {
            this.setState({})
        });
        setTimeout(() => {
            this.setState({ loading: false });
        }, 1000);
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
        this.db.collection('student').doc(this.useruid).update({
            name: this.state.name,
            class: this.state.class,
            totaltimeplayed: this.state.totaltimeplayed,
        }).then(() => {
            // localStorage.setItem("ae-username", this.state.name);
            // localStorage.setItem("ae-class", this.state.class);
            // localStorage.setItem('ae-totaltimeplayed', this.state.totaltimeplayed);
            this.success();
            setTimeout(() => {
                window.location.href = "/home/dashboard"
            }, 1000);
        }).catch(() => {
            this.error();
        })
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
            <div className='Editcontainer' >
                <ToastContainer />
                <div className='Editform'>
                    <div className='Edittitle'>
                        資料更新
                    </div>
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
