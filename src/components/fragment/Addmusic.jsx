import React from 'react';
import Form from './testForm';
import MusicList from './testMusicList';
import '../assets/scss/Addmusic.scss'
import 'firebase/firestore';
// import UploadImage from './UploadImage';

const Addmusic = () => {

  
  return (
    <div className='abc'>
        <Form/>
        <MusicList/>
        {/* <UploadImage/> */}
    </div>
  )
}

export default Addmusic