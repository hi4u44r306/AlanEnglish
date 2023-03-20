import React from 'react'
import Containerfull from '../fragment/Containerfull'
import './css/Makehomework.scss'
import firebase from "./firebase";
import { toast, ToastContainer } from "react-toastify"

function Makehomework() {

    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    const currentDate = `${year}-${month}-${day}`;

    const success = () => {
        toast.success('發布成功', {
            className: "notification",
            position: "top-center",
            autoClose: 1000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
        });
    };

    const handlePublishHomework = () => {
        const classtype = document.getElementById('class').value;
        const book = document.getElementById('book').value;
        const page = document.getElementById('page').value;
        const playtime = document.getElementById('playtime').value;
        const db = firebase.firestore();
        db.collection('Homework').doc(classtype).collection(currentDate).doc(currentDate).set({
            class: classtype,
            book: book,
            page: page,
            playtime: playtime,
        }, { merge: true }).then(() => {
            success();
        })
    };

    return (
        <Containerfull>
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
            <div className='mhmain'>
                <div className='mhcontainer'>
                    <div className='mhtitle'>指派功課</div>
                    <div className='mhsecondcontainer'>
                        <div className='inputcontainer'>
                            <div className='inputlabel'>班級 : </div>
                            <select id='class'>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>
                        <div className='inputcontainer'>
                            <div className='inputlabel'>日期 : </div>
                            <span>{currentDate}</span>
                        </div>
                        <div className='inputcontainer'>
                            <div className='inputlabel'>選擇書本 : </div>
                            <select id="book">
                                <option value="習作本1">習作本1</option>
                                <option value="習作本2">習作本2</option>
                                <option value="習作本3">習作本3</option>
                                <option value="習作本4">習作本4</option>
                                <option value="習作本5">習作本5</option>
                                <option value="習作本6">習作本6</option>

                                <option value="Super Easy Reading 3e 1">Super Easy Reading 3e 1</option>
                                <option value="Super Easy Reading 3e 2">Super Easy Reading 3e 2</option>
                                <option value="Super Easy Reading 3e 3">Super Easy Reading 3e 3</option>

                                <option value="Steam Reading E1">Steam Reading E1</option>
                                <option value="Steam Reading E2">Steam Reading E2</option>
                                <option value="Steam Reading E3">Steam Reading E3</option>

                                <option value="Reading Lamp 1 Reading">Reading Lamp 1 Reading</option>
                                <option value="Reading Lamp 2 Reading">Reading Lamp 2 Reading</option>
                                <option value="Reading Lamp 3 Reading">Reading Lamp 3 Reading</option>

                                <option value="Skyline1">Skyline1</option>
                                <option value="Skyline2">Skyline2</option>
                                <option value="Skyline3">Skyline3</option>

                                <option value="Short Articles 1">Short Articles 1</option>
                            </select>
                        </div>
                        <div className='inputcontainer'>
                            <div className='inputlabel'>頁數 : </div>
                            <input id='page' />
                        </div>

                        <div className='inputcontainer'>
                            <div className='inputlabel'>聽力次數 : </div>
                            <input id='playtime' />
                        </div>
                        <div className='mhbtncontainer'>
                            <button className='mhbtn' onClick={handlePublishHomework}>發布功課</button>
                        </div>
                    </div>
                </div>
            </div>
        </Containerfull>
    )
}

export default Makehomework