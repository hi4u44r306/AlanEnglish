import React from 'react';
import '../assets/scss/Developer.scss';
import {IconButton} from "@material-ui/core";
import AvatarImage from "../assets/img/avatar.jpg";
import {Facebook, Instagram, LinkedIn, Portrait, Twitter} from "@material-ui/icons";

const Developer = () => {
    return (
        <div className={"Developer"}>
            <h3 className={"Developer-head"}>Meet the teacher</h3>
            <div className="Developer-profile">
                <div className="Developer-profileCard">
                    <img src={AvatarImage} alt="Profile"/>
                    <div className={"Card-details"}>
                        <h3>Alan Hsu</h3>
                        <p>English Teacher</p>
                        <p>Graduated From 輔仁大學英語系</p>
                    </div>
                </div>
                <div className="Developer-profileDetails">
                    <h3>師資: </h3>
                    <p>1. 輔仁大學英日文系雙主修</p>
                    <p>2. 英國劍橋大學TESOL師資培訓</p>
                    <p>3. 公立國中合格英語教師資格</p>
                    <p>4. 全民英檢中高級通過</p>
                    <p>5. 戊類所長班培訓</p>
                    <p>6. 合格保育人員訓練</p>
                    <h3>著作: </h3>
                    <p>1. Phonics</p>
                    <p>2. K.K音標Book1&Book2</p>
                    <p>3. 入門英語</p>
                    <p>4. Vocabulary單字本 : Level 1~5</p>
                    <p>5. Reading   閱讀本 : ~15</p>
                    <p>6. 更多教材陸續編排中</p>
                    <div className="Card-btn">
                        <IconButton target={"_blank"}  href={"#"} title={"Alan Hsu"}>
                            <Facebook/>
                        </IconButton>
                        <IconButton target={"_blank"} href={"#"}  title={"Alan Hsu"}>
                            <Twitter/>
                        </IconButton>
                        <IconButton target={"_blank"} href={"#"}  title={"Alan Hsu"}>
                            <LinkedIn/>
                        </IconButton>
                        <IconButton target={"_blank"} href={"#"}  title={"Alan Hsu"}>
                            <Instagram/>
                        </IconButton>
                        <IconButton target={"_blank"} href={"#"}  title={"Alan Hsu"}>
                            <Portrait/>
                        </IconButton>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Developer;