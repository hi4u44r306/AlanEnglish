import React, { useRef } from 'react';
import '../assets/scss/Contactus.scss';
import SchoolImage from "../assets/img/school.jpg";
import emailjs from '@emailjs/browser';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const Contact = () => {

    const form = useRef();

    const notify = () =>  {
    toast.success('😻Send Successfully😻',{
        position: "top-center",
        autoClose: 2500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        });
    };


    function sendEmail(e){
        
        e.preventDefault();

        emailjs.sendForm('service_dgvbyle', 'Alan_English_Template', form.current, 'We6SlHIMVHI0rIZrp')
          .then((result) => {
              console.log(result.text);
          }, (error) => {
              console.log(error.text);
          });
          e.target.reset();
    };

    function inputEmpty(e){
        var x;
        x = document.getElementById("message").ariaValueMax;
        if(x === " "){
            alert("Enter message");
            return false;
        }
    }

    return (
        <div className={"Contact"}>
            <div className="Contact-profile">
                <div className="Contact-profileDetails">
                <h3 className='mx-auto'>聯絡我們</h3>
                    <form ref={form} onSubmit={sendEmail}>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>姓名</label>
                                <input id="message" type="text" name="name" placeholder="輸入姓名" />
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>Email</label>
                                <input id="message" type="email" name="email" placeholder="輸入Email" />
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>連絡電話</label>
                                <input id="message" type="phone" name="phone" placeholder="輸入電話號碼"/>
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>留言</label>
                                <input id="message" type="text" name="message" placeholder="輸入文字"/>
                            </div>
                            <div className="row mx-auto d-flex justify-content-center">
                                <button 
                                className='submitbtn' 
                                onClick={event => {
                                    notify();
                                    inputEmpty();
                                }}>傳送</button>
                                <ToastContainer
                                position="top-center"
                                autoClose={2500}
                                hideProgressBar={false}
                                newestOnTop={false}
                                closeOnClick
                                rtl={false}
                                pauseOnFocusLoss
                                draggable
                                pauseOnHover
                                />
                            </div>
                    </form>
                </div>
                <div className="Contact-profileCard">
                    <img src={SchoolImage} alt="Profile"/>
                </div>
            </div>
            
        </div>
        
    );
}

export default Contact;