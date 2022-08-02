import React from 'react';
import '../assets/scss/Contactus.scss';
import SchoolImage from "../assets/img/school.jpg";

const Contact = () => {
    return (
        <div className={"Contact"}>
        <div className="Contact-profile">
            <div className="Contact-profileCard">
                <img src={SchoolImage} alt="Profile"/>
            </div>

            <div className="Contact-profileDetails">
                
                <h3>Contact Us</h3>

            </div>

        </div>
    </div>
    );
}

export default Contact;