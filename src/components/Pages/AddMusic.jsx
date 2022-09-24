import React from 'react';
import Container from "../fragment/Container";
import Addmusic from "../fragment/Addmusic";
import Test from "../fragment/Test";
import './css/AddMusic.scss'


const AddMusic = () => {
  return (
    <Container>
        <div className={"Addmusic"}>
            {/* <Addmusic/> */}
            <Test/>
        </div>
    </Container>  
)
}

export default AddMusic