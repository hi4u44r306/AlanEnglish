import React, {useState} from 'react';
import '../assets/scss/MusicCard.scss';
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import {useDispatch} from "react-redux";
import {setCurrentPlaying} from "../../actions/actions";
import Name from "./Name";
import firebase from 'firebase/app';

function MusicCard(props) {
    const {bookname , page , img} = props.music;
    const db = firebase.firestore();
    const [timeplayed, setTimesplayed] = useState();//避免使用innerHTML, textContext 所以用useState();
    const [gamescore, setGamescore] = useState();//避免使用innerHTML, textContext 所以用useState();
    const dispatch = useDispatch();
    
    firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                getUserInfo(user);
            });
        }else{
            getUserInfo();
        }
    })

    const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid中的'Musics'documents, 並且傳送資料到checkmusicidmatch
        if(user){
            const convertmusicid = "'" + props.music.id + "'";
            db.collection('student').doc(user.uid).collection('Musics').doc(convertmusicid).get().then((doc)=>{
                setTimesplayed(doc.data().timeplayed);
            })
            db.collection('student').doc(user.uid).collection('Musics').doc(convertmusicid).get().then((doc)=>{
                setGamescore(doc.data().gamescore);
            })

            .catch((err)=>{
                console.log("There no data for some ID", err)
            })
        }else{
            console.log('no data');
        }
    }   

    function handlePlay() {
        dispatch(setCurrentPlaying(props.music))
    }


    return (
        <div className={"music-card"}>
            {
                <>
                <div onClick={handlePlay}  className={"music-card-cover"} >
                    <img src={require("../assets/img/" + img).default} alt={bookname}/>
                    <div className="play-circle">
                        <PlayCircleFilledWhiteIcon/>
                    </div>
                </div>
                <React.Fragment>
                    <Name name={bookname} className={"song-name"} length={bookname.length}/>
                    <Name name={page} className={"song-name"} length={page.length}/>
                
                    <div className="timesplayedcontainer">
                        <Name name={"播放次數:  "} className={"song-name"}/>
                        <Name name={timeplayed} className={"timeplayed"}/>
                        <Name name={"次"} className={"song-name"}/>
                    </div>
                    <div className="timesplayedcontainer">
                        <Name name={"測驗分數:  "} className={"song-name"}/>
                        <Name name={gamescore||"no score"} className={"timeplayed"}/>
                        <Name name={"分"} className={"song-name"}/>
                    </div>
                </React.Fragment>
            </>
            }
        </div>
    );
}

export default MusicCard;