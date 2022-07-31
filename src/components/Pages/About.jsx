import React from 'react';
import './css/About.scss';
import Container from "../fragment/Container";
import Developer from "../fragment/Developer";

const About = () => {
    return (
        <Container>
            <div className={"About"}>
                <Developer/>
            </div>
        </Container>
    );
}

export default About;
