import React, {useState} from 'react';
import '../assets/scss/MusicCard.scss';
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import {useDispatch} from "react-redux";
import {setCurrentPlaying} from "../../actions/actions";
import Name from "./Name";
import Game from "./Game";
import firebase from 'firebase/app';

function MusicCard(props) {
    const {bookname , page , img, questions, musicName} = props.music;
    const abc = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g,"")
    const [gamescore, setGamescore] = useState();
    const dispatch = useDispatch();
    
    const dbRef = firebase.database().ref();
    var userId = firebase.auth().currentUser.uid;
    dbRef.child("student").child(userId).child("quiz").child(abc).child("score").get().then((snapshot) => {
        if (snapshot.exists()) {
            // console.log(snapshot.val());
            setGamescore(snapshot.val());
        } else {
            // console.log("No score");
        }
    }).catch((error) => {
        console.error(error);
    });

    function handlePlay() {
        dispatch(setCurrentPlaying(props.music))
    }
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={"music-card"}>
            {
            <>
                {/* Web */}
                <div className='web'>
                    <div onClick={handlePlay} className={"music-card-cover"} >
                        <img src={require("../assets/img/" + img).default} alt={bookname}/>
                        <div className="play-circle">
                            <PlayCircleFilledWhiteIcon/>
                        </div>
                    </div>
                    <React.Fragment>
                        <div className='gamesection'>
                            <Game bookname={bookname} pagename={page} open={isOpen} questionsinmusic={questions} musicName={musicName} onClose={()=>setIsOpen(false)}></Game>
                        </div>
                        <Name name={bookname} className={"song-name"} length={bookname.length}/>
                        <Name name={page} className={"song-name"} length={page.length}/>
                        <div className="timesplayedcontainer-web">
                            <Name name={"小測驗:  "} className={"song-name"}/>
                            <Name name={gamescore||"------"} className={"timeplayed"}/>
                            <Name name={"  "} className={"song-name"}/>
                        </div>
                    </React.Fragment>
                    <div className='d-flex justify-content-center'>
                        <div onClick={handlePlay} className={"music-card-cover"} >
                            <div onClick={handlePlay} className='testbutton'>
                                <span>播放</span>
                                <PlayCircleOutlineIcon className="playicon"/>
                            </div>
                        </div>
                        <div onClick=
                        {
                            ()=> 
                            {
                                if(questions === undefined)
                                {
                                    setIsOpen(false); 
                                    alert('目前未開放')
                                }
                                else{
                                    setIsOpen(true);
                                }
                            }
                        } className={"music-card-cover"} >
                            <div className='testbutton'>
                                <span>小測驗</span>
                                <PlayCircleOutlineIcon className="circleicon"/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* //////////////////////////////////////// */}

                {/* Mobile */}
                <div className='mobile'>
                    <React.Fragment>
                        <div className='musicbanner'>
                            <div onClick={handlePlay} className={"music-card-cover"} >
                                <img src={require("../assets/img/" + img).default} alt={bookname}/>
                                <div className="play-circle">
                                    <PlayCircleFilledWhiteIcon/>
                                </div>
                            </div>
                            <div className='gamesection'>
                                <Game bookname={bookname} pagename={page} open={isOpen} questionsinmusic={questions} musicName={musicName} onClose={()=>setIsOpen(false)}></Game>
                            </div>
                            <div>
                                <Name name={bookname} className={"song-name"} length={bookname.length}/>
                                <Name name={page} className={"song-name"} length={page.length}/>
                            </div>
                        </div>
                    </React.Fragment>
                    <div className='buttoncontainer'>
                        <div onClick={handlePlay} className={"music-card-cover"} >
                            <div onClick={handlePlay} className='testbutton'>
                                <span>播放</span>
                                <PlayCircleOutlineIcon className="playicon"/>
                            </div>
                        </div>
                        <div onClick=
                        {
                            ()=> 
                            {
                                if(questions === undefined)
                                {
                                    setIsOpen(false); 
                                    alert('目前未開放')
                                }
                                else{
                                    setIsOpen(true);
                                }
                            }
                        } className={"music-card-cover"} >
                            <div className='testbutton'>
                                <span>測驗</span>
                                <PlayCircleOutlineIcon className="circleicon"/>
                            </div>
                        </div>
                        <React.Fragment>
                            <div className="timesplayedcontainer-mobile">
                                <Name name={"測驗 :  "} className={"quizlabel"}/>
                                <Name name={ gamescore ||" ---- "} className={"timeplayed"}/>
                                <Name name={"  "} className={"song-name"}/>
                            </div>
                        </React.Fragment>
                    </div>
                </div>
            </>
            }
        </div>
    );
}

export default MusicCard;