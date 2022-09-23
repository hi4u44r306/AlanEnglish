import React from 'react';
import Container from "../fragment/Container";
import Addmusic from "../fragment/Addmusic";
import './css/AddMusic.scss'


const AddMusic = () => {
  return (
    <Container>
        <div className={"Addmusic"}>
            <Addmusic/>
        </div>
    </Container>  
)
}

export default AddMusic