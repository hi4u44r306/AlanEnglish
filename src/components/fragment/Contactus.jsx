import React, { useRef } from 'react';
import '../assets/scss/Contactus.scss';
import SchoolImage from "../assets/img/school.jpg";
import emailjs from '@emailjs/browser';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const Contact = () => {

    const form = useRef();
    const inputname = useRef();
    const inputemail = useRef();
    const inputphone = useRef();
    const inputmessage = useRef();
    
    function inputValidate(e){
        e.preventDefault();
        if(inputname.current.value === "" || inputemail.current.value === "" || inputphone.current.value === ""|| inputmessage.current.value === ""){
            error();
        }else{
            sendEmail();
            success();
            clear();
        }
    }

    const clear = () => {
        inputname.current.value = '';
        inputemail.current.value = '';
        inputphone.current.value = '';
        inputmessage.current.value = '';
    }
    

    const error = () =>  {
        toast.error('🙀欄位不能空白🙀',{
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    const success = () =>  {
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

    function sendEmail(){
        
        emailjs.sendForm('service_dgvbyle', 'Alan_English_Template', form.current, 'We6SlHIMVHI0rIZrp')
          .then((result) => {
              console.log(result.text);
          }, (error) => {
              console.log(error.text);
          });
    };


    return (
        <div className={"Contact"}>
            <div className="Contact-profile">
                <div className="Contact-profileDetails">
                <h3 className='mx-auto'>聯絡我們</h3>
                    <form ref={form} onSubmit={inputValidate}>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>姓名</label>
                                <input ref={inputname} id="message" type="text" name="name" placeholder="輸入姓名" />
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>Email</label>
                                <input ref={inputemail} id="message" type="email" name="email" placeholder="輸入Email" />
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>連絡電話</label>
                                <input ref={inputphone} id="message" type="phone" name="phone" placeholder="輸入電話號碼"/>
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>留言</label>
                                <input ref={inputmessage} id="message" type="text" name="message" placeholder="輸入文字"/>
                            </div>
                            <div className="row mx-auto d-flex justify-content-center">
                                <button className='submitbtn' onClick={inputValidate}>傳送</button>
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