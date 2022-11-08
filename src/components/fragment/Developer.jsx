import React from 'react';
import '../assets/scss/Developer.scss';
import AlanImage from "../assets/img/avatar.jpg";
import VictorImage from "../assets/img/victor.jpg";

const Developer = () => {
    return (
        <div className={"Developer"}>
            <div className="Developer-profile">
                <div className="Developer-profileCard">
                    <div className='Developer-title'>AlanEnglish 創辦人</div>
                    <img className='Developer-img' src={AlanImage} alt="Profile"/>
                    <div className='Developer-title'>Alan Hsu</div>
                </div>
                <div className="Developer-profileDetails">
                    <div className='d-flex justify-content-center'>
                        <div className='Developer-title'>Alan Hsu</div>
                    </div>
                    <div className='Developer-text'> 1. 桃園課後照顧中心班主任</div>
                    <div className='Developer-text'> 2. Alan English 創辦人</div>
                    <div className='Developer-text'> 3. 輔仁大學英日文系雙主修</div>
                    <div className='Developer-text'> 4. 英國劍橋大學TESOL師資培訓</div>
                    <div className='Developer-text'> 5. 公立國中合格英語教師資格</div>
                    <div className='Developer-text'> 6. 戊類所長班培訓</div>
                    <div className='Developer-text'> 7. 合格保育人員</div>
                    <div className='d-flex justify-content-center'>
                        <div className='Developer-title'>著作: </div>   
                    </div>
                    <div className='Developer-text'>1. Phonics K.K</div>
                    <div className='Developer-text'>2. Alan English 習作本 & 聽力本</div>
                    <div className='Developer-text'>3. 發明速算尺</div>
                    <div className='Developer-text'>4. 編輯速算尺講義</div>
                    <div className='Developer-text'>5. 更多教材陸續編排中...</div>
                </div>
                <div className="Developer-profileCard">
                    <div className='Developer-title'>AlanEnglish 網站開發人員</div>
                    <img className='Developer-img' src={VictorImage} alt="Profile"/>
                    <div className='Developer-title'>Victor Hsu</div>
                </div>
            </div>
        </div>
    );
}

export default Developer;