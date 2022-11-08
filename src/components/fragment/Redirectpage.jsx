import React from 'react'
import "../assets/scss/Redirectpage.css"
import video from '../assets/img/loadingvideo.mp4'


function Redirectpage() {
  return (
    <div className='Redirectcontainer'>
        {/* <div className='rocketicon'>
            🚀
        </div> */}
        <div className='loading'>
            <video autoPlay muted loop id="myVideo" className='loading' src={video}></video> 
        </div>
        {/* <div className='alertmessage'>
            您似乎沒有登入，請回首頁登入
        </div>

        <div>
            <button  className='redirectbtn' 
            onClick={(e) => {
            e.preventDefault();
            window.location.href='http://alanenglish.com.tw';
            }}>首頁</button>
        </div> */}
    </div>
  )
}

export default Redirectpage