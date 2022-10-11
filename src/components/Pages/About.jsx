import React from 'react';
import './css/About.scss';
import Containerfull from "../fragment/Containerfull";
import Developer from "../fragment/Developer";

const About = () => {
    return (
        <Containerfull>
            <div className={"About"}>
                <Developer/>
            </div>
        </Containerfull>
    );
}

export default About;
