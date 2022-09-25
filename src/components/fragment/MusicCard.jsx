import React, {useEffect, useState} from 'react';
import '../assets/scss/MusicCard.scss';
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";
import {useDispatch} from "react-redux";
import {setCurrentPlaying} from "../../actions/actions";
import Name from "./Name";
import {Skeleton} from "@material-ui/lab";
import Box from "@material-ui/core/Box";
import firebase from 'firebase/app';
import ClipLoader from "react-spinners/ClipLoader";

function MusicCard(props) {
    const { bookname , page , img} = props.music;
    const [isHovered, setHovered] = useState(false);
    const [loading, setLoading] = useState(false);
    const db = firebase.firestore();
    const [timeplayed, setTimesplayed] = useState();//避免使用innerHTML, textContext 所以用useState();

    useEffect(()=>{
        setLoading(true)
        setTimeout(() =>{
            setLoading(false);
        }, 2000)
    }, [])

    firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                getUserInfo(user);
            });
        }else{
            getUserInfo();
        }
    })

    const checkmusicidmatch = (music, user) =>{ //接收到從getUserInfo()中的(music,user)資料，去比對Local database 與 Firestore database 中的musicid 是否吻合
        const localmusicid = "'" + props.music.id + "'";
        const firestoremusicid = music.id;
        if(localmusicid === firestoremusicid){
            db.collection("student").doc(user.uid).collection('Musics').doc(music.id).onSnapshot(doc =>{
                setTimesplayed(doc.data().timeplayed);
            });
        }else{

        }
    }
    const getUserInfo = (user) =>{  //從firestore取得 student 集合中選取符合user.uid中的'Musics'documents, 並且傳送資料到checkmusicidmatch
        if(user){
            db.collection("student").doc(user.uid).collection('Musics').get()
            .then((querySnapshot) => {
                querySnapshot.forEach((music) => {
                    checkmusicidmatch(music, user);
                });
            })
            .catch((error) => {
                console.log("Error getting documents: ", error);
            });
        }else{
            console.log('no data');
        }
    }   

    function handleResponse() {
        setHovered(!isHovered);
    }

    const dispatch = useDispatch();

    function handlePlay() {
        dispatch(setCurrentPlaying(props.music))
    }

    const [loaded , setLoaded] = useState(false);

    useEffect(()=>{
        setLoaded(true)
    },[]);

    return (
        <div className={"music-card"}>
            {
                !loaded ?
                <div className={"Skeleton-top"}>
                    <Skeleton variant="rect" width={210} height={210} />
                    <Box pt={0.5}>
                        <Skeleton />
                        <Skeleton width="60%" />
                    </Box>
                </div>
                    :
                    <>
                        <div onClick={handlePlay}  className={"music-card-cover"} onMouseOver={handleResponse}>
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
                                {
                            loading ?
                            (
                                <ClipLoader 
                                color={"#fc0303"} 
                                loading={loading} 
                                size={15} 
                                />
                            )
                            :
                            (
                                <Name name={timeplayed} className={"timeplayed"}/>
                            )
                            }
                                <Name name={"次"} className={"song-name"}/>
                            </div>

                        </React.Fragment>
                    </>
            }


        </div>
    );
}

export default MusicCard;