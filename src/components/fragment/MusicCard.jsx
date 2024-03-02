import React, { useEffect, useState } from 'react';
import '../assets/scss/MusicCard.scss';
import { AiFillPlayCircle } from "react-icons/ai";
import { FaAddressCard } from "react-icons/fa";
// import MenuBookIcon from '@mui/icons-material/MenuBook';
// import ShareIcon from '@mui/icons-material/Share';
import { useDispatch } from "react-redux";
import { setCurrentMargin, setCurrentPlaying } from "../../actions/actions";
import Name from "./Name";
import CardGame from "./CardGame";
import BooktextGame from './BooktextGame';
import { child, get, getDatabase, ref } from 'firebase/database';

function MusicCard(props) {
    const { bookname, page, img, questions, musicName, booktext } = props.music;
    const useruid = localStorage.getItem('ae-useruid');
    const [gamescore, setGamescore] = useState();
    const [cardgameisOpen, setcardgameIsOpen] = useState(false);
    const [booktextgameisOpen, setbooktextIsOpen] = useState(false);
    const quizname = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g, "")
    const dispatch = useDispatch();

    useEffect(() => {
        const db = getDatabase();
        const dbRef = ref(db);
        get(child(dbRef, `student/${useruid}/quiz/${quizname}/score`))
            .then((snapshot) => {
                if (snapshot.exists()) {
                    setGamescore(snapshot.val());
                } else {
                    setGamescore();
                }
            })
            .catch((error) => {
                console.error(error);
            });
    }, [quizname, useruid]);

    function handlePlay() {
        dispatch(setCurrentMargin('100px'))
        dispatch(setCurrentPlaying(props.music))
    }
    function handleStop() {
        dispatch(setCurrentPlaying());
    }

    return (
        <div className={"music-card"}>
            <div className='web'>
                <React.Fragment>
                    <div className='musicbanner'>

                        <div className='gamesection'>
                            <CardGame bookname={bookname} pagename={page} open={cardgameisOpen} questionsinmusic={questions} musicName={musicName} onClose={() => setcardgameIsOpen(false)}></CardGame>

                            <BooktextGame bookname={bookname} pagename={page} open={booktextgameisOpen} musicName={musicName} booktext={booktext} onClose={() => setbooktextIsOpen(false)}></BooktextGame>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}>
                            <img src={require("../assets/img/" + img)} alt={bookname} className='musiccardimage' />
                            <Name name={bookname} className={"book-name"} length={bookname.length} />
                            <Name name={page} className={"page-name"} length={page.length} />
                        </div>

                        <div className='buttoncontainer'>
                            <div style={{ display: 'flex' }}>
                                <div onClick={handlePlay} className='testbutton'>
                                    <span>播放</span>
                                    <AiFillPlayCircle className="playicon" />
                                </div>
                                <div onClick=
                                    {
                                        () => {
                                            handleStop()

                                            //之後可以用
                                            // dispatch(setCurrentMargin(0))
                                            if (questions === undefined) {
                                                // setcardgameIsOpen(false);
                                                alert('目前未開放')
                                            }
                                            else {
                                                alert('目前未開放')
                                                // setcardgameIsOpen(true);
                                            }
                                        }
                                    }>
                                    <div className='gamebutton'>
                                        <span>小遊戲</span>
                                        <FaAddressCard className="circleicon" />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                                    {/* <div className='gamebutton'>
                                                <span>課文</span>
                                                <MenuBookIcon className="circleicon" />
                                            </div> */}
                                </div>
                            </div>
                            <React.Fragment>
                                <div className="timesplayedcontainer-mobile">
                                    <Name name={"測驗 :  "} className={"quizlabel"} />
                                    <Name name={gamescore || " ---- "} className={"timeplayed"} />
                                    <Name name={"  "} className={"book-name"} />
                                </div>
                            </React.Fragment>
                        </div>
                    </div>
                </React.Fragment>
                {/* <React.Fragment>
                    <div className='gamesection'>
                        <CardGame bookname={bookname} pagename={page} open={cardgameisOpen} questionsinmusic={questions} musicName={musicName} onClose={() => setcardgameIsOpen(false)}></CardGame>

                        <BooktextGame bookname={bookname} pagename={page} open={booktextgameisOpen} musicName={musicName} booktext={booktext} onClose={() => setbooktextIsOpen(false)}></BooktextGame>
                    </div>


                    <div className='d-flex justify-content-center'>
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
                                <FaBook className="circleicon" />
                            </div>
                        </div>
                    </div>
                </React.Fragment> */}
            </div>
        </div>
    );
}

export default MusicCard;