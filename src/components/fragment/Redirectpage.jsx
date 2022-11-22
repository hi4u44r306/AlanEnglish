import React from 'react'
import "../assets/scss/Redirectpage.css"
import video from '../assets/img/loadingvideo.mp4'
// import video from '../assets/img/loadingvideo-unscreen.gif'


function Redirectpage() {
  return (
    <div className='Redirectcontainer'>
        <div className='loadingtext'>
          <div>
            Loading 
          </div>
          <div className="loaderredirect"></div>
        </div>
        <div className='loading'>
            <video autoPlay muted loop id="myVideo" className='loading' src={video}></video> 
        </div>
    </div>
  )
}

export default Redirectpage