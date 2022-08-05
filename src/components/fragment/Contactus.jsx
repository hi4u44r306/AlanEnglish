import React, { useRef } from 'react';
import '../assets/scss/Contactus.scss';
import SchoolImage from "../assets/img/school.jpg";
// import Button from 'react-bootstrap/Button';
// import Form from 'react-bootstrap/Form';
import emailjs from '@emailjs/browser';


const Contact = () => {

    const form = useRef();

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

    return (
        <div className={"Contact"}>
            <div className="Contact-profile">
                <div className="Contact-profileDetails">
                <h3 className='mx-auto'>聯絡我們</h3>
                    <form ref={form} onSubmit={sendEmail}>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>姓名</label>
                                <input type="text" name="name" placeholder="輸入姓名"/>
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>Email</label>
                                <input type="email" name="email" placeholder="輸入Email"/>
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>連絡電話</label>
                                <input type="phone" name="phone" placeholder="輸入電話號碼"/>
                            </div>
                            <div className="md-3 mx-auto border border-primary input-field">
                                <label>留言</label>
                                <input type="text" name="message" placeholder="輸入文字"/>
                            </div>
                            <div className="row mx-auto">
                                <input className='mx-auto btn' type="submit" value="傳送"/>
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