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
                        <p>Graduate From 輔仁大學英語系</p>
                    </div>
                </div>
                <div className="Developer-profileDetails">
                    <p>Type something here later~~~Type something here later~~~Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
                    <p>Type something here later~~~</p>
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