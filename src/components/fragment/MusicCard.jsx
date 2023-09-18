import React, { useEffect, useState } from 'react';
import '../assets/scss/MusicCard.scss';
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
// import MenuBookIcon from '@mui/icons-material/MenuBook';
// import ShareIcon from '@mui/icons-material/Share';
import { useDispatch } from "react-redux";
import { setCurrentPlaying } from "../../actions/actions";
import Name from "./Name";
import CardGame from "./CardGame";
import firebase from 'firebase/app';
import BooktextGame from './BooktextGame';

function MusicCard(props) {
    const { bookname, page, img, questions, musicName, booktext } = props.music;
    const useruid = localStorage.getItem('ae-useruid');
    const [gamescore, setGamescore] = useState();
    const [cardgameisOpen, setcardgameIsOpen] = useState(false);
    const [booktextgameisOpen, setbooktextIsOpen] = useState(false);
    const quizname = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g, "")
    const dispatch = useDispatch();

    useEffect(() => {
        const dbRef = firebase.database().ref();
        dbRef.child("student").child(useruid).child("quiz").child(quizname).child("score").get().then((snapshot) => {
            if (snapshot.exists()) {
                setGamescore(snapshot.val());
            } else {
                setGamescore();
            }
        }).catch((error) => {
            console.error(error);
        });
    }, [quizname, useruid])

    function handlePlay() {
        dispatch(setCurrentPlaying(props.music))
    }
    function handleStop() {
        dispatch(setCurrentPlaying());
    }

    return (
        <div className={"music-card"}>
            {
                <>
                    {/* Web */}
                    <div className='web'>
                        {/* <div className='sharebtn-container'>
                            <ShareIcon className='sharebtn' />
                        </div> */}
                        <div onClick={handlePlay} className={"music-card-cover"} >
                            <img src={require("../assets/img/" + img).default} alt={bookname} />
                            <div className="play-circle">
                                <PlayCircleFilledWhiteIcon />
                            </div>
                        </div>
                        <React.Fragment>
                            <div className='gamesection'>
                                <CardGame bookname={bookname} pagename={page} open={cardgameisOpen} questionsinmusic={questions} musicName={musicName} onClose={() => setcardgameIsOpen(false)}></CardGame>

                                <BooktextGame bookname={bookname} pagename={page} open={booktextgameisOpen} musicName={musicName} booktext={booktext} onClose={() => setbooktextIsOpen(false)}></BooktextGame>
                            </div>
                            <Name name={bookname} className={"song-name"} length={bookname.length} />
                            <Name name={page} className={"song-name"} length={page.length} />
                            <div className="timesplayedcontainer-web">
                                <Name name={"小測驗:  "} className={"song-name"} />
                                <Name name={gamescore || "------"} className={"timeplayed"} />
                                <Name name={"  "} className={"song-name"} />
                            </div>
                        </React.Fragment>
                        <div className='d-flex justify-content-center'>
                            <div onClick={handlePlay} className={"music-card-cover"} >
                                <div onClick={handlePlay} className='testbutton'>
                                    <span>播放</span>
                                    <PlayCircleOutlineIcon className="playicon" />
                                </div>
                            </div>
                            <div onClick=
                                {
                                    () => {
                                        handleStop()
                                        if (booktext === undefined) {
                                            setcardgameIsOpen(false);
                                            alert('目前未開放')
                                        }
                                        else {
                                            setcardgameIsOpen(true);
                                        }
                                    }
                                } className={"music-card-cover"} >
                                <div className='gamebutton'>
                                    <span>小遊戲</span>
                                    <VideogameAssetIcon className="circleicon" />
                                </div>
                            </div>
                        </div>

                        {/* <div className='d-flex justify-content-center'>
                            <div onClick=
                                {
                                    () => {
                                        handleStop()
                                        if (questions === undefined) {
                                            setbooktextIsOpen(false);
                                            alert('未開放課文')
                                        }
                                        else {
                                            setbooktextIsOpen(true);
                                        }
                                    }
                                } className={"music-card-cover"} >
                                <div className='gamebutton'>
                                    <span>課文</span>
                                    <MenuBookIcon className="circleicon" />
                                </div>
                            </div>
                        </div> */}
                    </div>

                    {/* //////////////////////////////////////// */}

                    {/* Mobile */}
                    <div className='mobile'>
                        {/* <ShareIcon className='sharebtn' /> */}
                        <React.Fragment>
                            <div className='musicbanner'>
                                <div onClick={handlePlay} className={"music-card-cover"} >
                                    <img src={require("../assets/img/" + img).default} alt={bookname} />
                                    <div className="play-circle">
                                        <PlayCircleFilledWhiteIcon />
                                    </div>
                                </div>
                                <div className='gamesection'>
                                    <CardGame bookname={bookname} pagename={page} open={cardgameisOpen} questionsinmusic={questions} musicName={musicName} onClose={() => setcardgameIsOpen(false)}></CardGame>

                                    <BooktextGame bookname={bookname} pagename={page} open={booktextgameisOpen} musicName={musicName} booktext={booktext} onClose={() => setbooktextIsOpen(false)}></BooktextGame>
                                </div>
                                <div>
                                    <Name name={bookname} className={"song-name"} length={bookname.length} />
                                    <Name name={page} className={"song-name"} length={page.length} />
                                </div>
                            </div>
                        </React.Fragment>
                        <div className='buttoncontainer'>
                            <div style={{ display: 'flex' }}>
                                <div onClick={handlePlay} className={"music-card-cover"} >
                                    <div onClick={handlePlay} className='testbutton'>
                                        <span>播放</span>
                                        <PlayCircleOutlineIcon className="playicon" />
                                    </div>
                                </div>
                                <div onClick=
                                    {
                                        () => {
                                            handleStop()
                                            if (questions === undefined) {
                                                setcardgameIsOpen(false);
                                                alert('目前未開放')
                                            }
                                            else {
                                                setcardgameIsOpen(true);
                                            }
                                        }
                                    } className={"music-card-cover"} >
                                    <div className='gamebutton'>
                                        <span>小遊戲</span>
                                        <VideogameAssetIcon className="circleicon" />
                                    </div>
                                </div>
                            </div>
                            {/* <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div onClick=
                                    {
                                        () => {
                                            handleStop()
                                            if (questions === undefined) {
                                                setbooktextIsOpen(false);
                                                alert('未開放課文')
                                            }
                                            else {
                                                setbooktextIsOpen(true);
                                            }
                                        }
                                    } className={"music-card-cover"} >
                                    <div className='gamebutton'>
                                        <span>課文</span>
                                        <MenuBookIcon className="circleicon" />
                                    </div>
                                </div>
                            </div> */}
                            <React.Fragment>
                                <div className="timesplayedcontainer-mobile">
                                    <Name name={"測驗 :  "} className={"quizlabel"} />
                                    <Name name={gamescore || " ---- "} className={"timeplayed"} />
                                    <Name name={"  "} className={"song-name"} />
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