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
                    <img src={AlanImage} alt="Profile"/>
                    <div className='Developer-title'>Alan Hsu</div>
                </div>
                <div className="Developer-profileDetails">
                    <div className='d-flex justify-content-center'>
                        <div className='Developer-title'>Alan Hsu</div>
                    </div>
                    <p> 1. 桃園課後照顧中心班主任</p>
                    <p> 2. Alan English 創辦人</p>
                    <p> 3. 輔仁大學英日文系雙主修</p>
                    <p> 4. 英國劍橋大學TESOL師資培訓</p>
                    <p> 5. 公立國中合格英語教師資格</p>
                    <p> 6. 戊類所長班培訓</p>
                    <p> 7. 合格保育人員</p>
                    <div className='d-flex justify-content-center'>
                        <div className='Developer-title'>著作: </div>   
                    </div>
                    <p>1. Phonics K.K</p>
                    <p>2. Alan English 習作本 & 聽力本</p>
                    <p>3. 發明速算尺</p>
                    <p>4. 編輯速算尺講義</p>
                    <p>5. 更多教材陸續編排中...</p>
                </div>
                {/* <div className="Developer-profileDetails">
                    <h3>著作: </h3>
                    <p>1. Phonics K.K</p>
                    <p>2. Alan English 習作本 & 聽力本</p>
                    <p>3. 發明速算尺</p>
                    <p>4. 編輯速算尺講義</p>
                    <p>5. 更多教材陸續編排中...</p>
                </div> */}
                <div className="Developer-profileCard">
                    <div className='Developer-title'>AlanEnglish 網站開發人員</div>
                    <img src={VictorImage} alt="Profile"/>
                    <div className='Developer-title'>Victor Hsu</div>
                </div>
            </div>
        </div>
    );
}

export default Developer;