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
                <p>1. Phonics</p>
                <p>2. K.K音標Book1&Book2</p>
                <p>3. 入門英語</p>
                <p>4. Vocabulary單字本 : Level 1~5</p>
                <p>5. Reading   閱讀本 : ~15</p>
                <p>6. 更多教材陸續編排中...</p>
            </div>

        </div>
    </div>
    );
}

export default Contact;