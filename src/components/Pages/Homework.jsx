import React from 'react'
import Containerfull from '../fragment/Containerfull'
import './css/Homework.scss'

function Homework() {

    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    const currentDate = `${year}-${month}-${day}`;
    const classtype = localStorage.getItem('ae-class')
    const book = localStorage.getItem('ae-hwbook');
    const page = localStorage.getItem('ae-hwpage');
    const playtime = localStorage.getItem('ae-hwplaytime');

    return (
        <Containerfull>
            <div className='mhmain'>
                <div className='mhcontainer'>
                    <div className='mhtitle'>今日功課 (測試中)</div>
                    {
                        book === '' ?
                            <div>今日無功課</div>
                            :
                            <div className='mhsecondcontainer'>
                                <div className='inputcontainer'>
                                    <div className='inputlabel'>日期 : </div>
                                    <span>{currentDate}</span>
                                </div>
                                <div className='inputcontainer'>
                                    <div className='inputlabel'>班級 : </div>
                                    <div>{classtype} 班</div>
                                </div>
                                <div className='inputcontainer'>
                                    <div className='inputlabel'>選擇書本 : </div>
                                    <div>{book}</div>
                                </div>
                                <div className='inputcontainer'>
                                    <div className='inputlabel'>頁數 : </div>
                                    <div>{page} 頁</div>
                                </div>

                                <div className='inputcontainer'>
                                    <div className='inputlabel'>聽力次數 : </div>
                                    <div>{playtime} 次</div>
                                </div>
                            </div>
                    }
                </div>
            </div>
        </Containerfull>
    )
}

export default Homework