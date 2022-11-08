import React from 'react'
import "../assets/scss/Redirectpage.css"

function Redirectpage() {
  return (
    <div className='Redirectcontainer'>
        <div className='rocketicon'>
            🚀
        </div>
        <div className='alertmessage'>
            您似乎沒有登入，請回首頁登入
        </div>

        <div>
            <button  className='redirectbtn' 
            onClick={(e) => {
            e.preventDefault();
            window.location.href='http://alanenglish.com.tw';
            }}>首頁</button>
        </div>
    </div>
  )
}

export default Redirectpage