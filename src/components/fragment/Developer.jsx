import React from 'react';
import '../assets/scss/Developer.scss';
import AvatarImage from "../assets/img/avatar.jpg";

const Developer = () => {
    return (
        <div className={"Developer"}>
            <h3 className={"Developer-head"}>Meet the teacher</h3>
            <div className="Developer-profile">
                <div className="Developer-profileCard">
                    <img src={AvatarImage} alt="Profile"/>
                </div>
                <div className="Developer-profileDetails-1">
                    <h3>Alan Hsu</h3>
                    <p> 1. 桃園課後照顧中心班主任</p>
                    <p> 2. Alan English 創辦人</p>
                    <p> 3. 輔仁大學英日文系雙主修</p>
                    <p> 4. 英國劍橋大學TESOL師資培訓</p>
                    <p> 5. 公立國中合格英語教師資格</p>
                    <p> 6. 戊類所長班培訓</p>
                    <p> 7. 合格保育人員</p>
                </div>
                <div className="Developer-profileDetails-2">
                    
                    <h3>著作: </h3>
                    <p>1. Phonics K.K</p>
                    <p>2. Alan English 習作本 & 聽力本</p>
                    <p>3. 發明速算尺</p>
                    <p>4. 編輯速算尺講義</p>
                    <p>5. 更多教材陸續編排中...</p>
                </div>

            </div>
        </div>
    );
}

export default Developer;