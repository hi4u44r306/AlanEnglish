import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player'
import React, {useRef, useState, useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import {setCurrentPlaying} from "../../actions/actions";
import { toast, ToastContainer} from "react-toastify"
import Marquee from "react-fast-marquee";
import firebase from 'firebase/app';
import Name from "./Name";
import '../assets/scss/FooterPlayer.scss';
import 'react-h5-audio-player/lib/styles.css';


function FooterMusicPlayer({music}) {

    const [{ id, bookname, page , musicName}, setCurrTrack] = useState(music);
    const {playlists} = useSelector(state => state.musicReducer);
    const [currentuser,setCurrUser] = useState();
    const currplayingmusicid = "'" + id + "'";
    const db = firebase.firestore();
    const dispatch = useDispatch();
    const audioElement = useRef();

    const currentDate = new Date().toJSON().slice(0, 10);


    const success = () =>  {
        toast.success('太棒了 聽力次數+1 請刷新頁面更新聆聽次數',{
            className:"musicnotification",
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    const secondsuccess = () =>  {
        toast.info('再多聽幾次可以跟老師換禮物喔!!',{
            className:"musicnotification",
            position: "top-center",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            });
        };

    // const repeattimesuccess = () =>  {
    //     toast.success('重播次數+1 請刷新頁面更新聆聽次數',{
    //         className:"musicnotification",
    //         position: "bottom-left",
    //         autoClose: 2500,
    //         hideProgressBar: false,
    //         closeOnClick: true,
    //         pauseOnHover: false,
    //         draggable: true,
    //         progress: undefined,
    //         });
    //     };

    useEffect(() => {
        setCurrTrack(music);
    }, [music]);
        
    firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                setCurrUser(user.uid);
            });
        }else{
            updatetimeplayedtofirestore();
        }
    });

    
    const updatetimeplayedtofirestore = () => {
        if(currplayingmusicid){
            
            ////當前音軌次數增加////
            const userRef = db.collection('student').doc(currentuser);   
            userRef.collection('Musics').doc(currplayingmusicid).get().then((doc)=>{
                const a = doc.data().timeplayed;
                const b = parseInt(a)+1;
                userRef.collection('Musics').doc(currplayingmusicid).set({
                    timeplayed: b,
                })
                console.log('timeplayed + 1');
            }).catch((err)=>{
                console.log(err.message);
            })
            ////結束////


            ////記錄檔中的當前音軌當天次數增加////
            const logfileRef = db.collection('student').doc(currentuser).collection('Logfile').doc(currentDate).collection(currplayingmusicid).doc(currplayingmusicid)
            const test = db.collection('student').doc(currentuser).collection('Logfile').doc(currentDate)
            if(test !== null){
                logfileRef.get().then((doc)=>{///如果Firebase 有這筆資料播放次數 + 1///
                    const a = doc.data().timeplayed;
                    const b = parseInt(a)+1;   
                    logfileRef.update({
                        timeplayed: b,
                    }).then(() => {
                        console.log(currentDate, " id: ", currplayingmusicid , 'time played update', b);
                    })
                }).catch(() => { ///如果Firebase 中沒有這筆資料則新增///
                    const newdaytimeplayed = 1;
                    logfileRef.set({
                        timeplayed: newdaytimeplayed
                    }).then(() =>{
                        console.log(currentDate, "id :", currplayingmusicid ,'new update');
                    })
                });
            }else{

            }
           
            ////結束////


            /////////////////////////////////////////////////////////////////////////


            ////當天總次數統計////
            // const bb = userRef.collection('Logfile').doc(currentDate).get().then((doc)=>{
            //     console.log(doc.data().newdaytotaltimeplayed);
            // });
            // if(bb === true){
            //     userRef.collection('Logfile').doc(currentDate).get().then((doc)=>{
            //         const c = doc.data().newdaytotaltimeplayed;
            //         const d = parseInt(c)+1;
            //         userRef.collection('Logfile').doc(currentDate).update({
            //             newdaytotaltimeplayed: d
            //         })
            //     });
            // }else{
            //     const newdaytotaltimeplayed = 0;
            //     userRef.collection('Logfile').doc(currentDate).collection(currplayingmusicid).doc(currplayingmusicid).set({
            //         timeplayed: newdaytotaltimeplayed,
            //     })
            // }
            ////當天總次數統計 結束////


            /////////////////////////////////////////////////////////////////////////


            ////所有音軌總次數增加////
            userRef.get().then((doc)=>{  
                const c = doc.data().totaltimeplayed;
                const d = parseInt(c)+1;
                db.collection('student').doc(currentuser).update({
                    totaltimeplayed: d,
                })
            })
        }else{
            console.log("update currplayingmusicid failed");
        }
    };

    // const update_repeat_timeplayed = () => {
    //     if(currplayingmusicid){
    //         const userRef = db.collection('student').doc(currentuser);
    //         userRef.collection('Musics').doc(currplayingmusicid).get().then((doc)=>{
    //             const a = doc.data().timeplayed;
    //             const b = parseInt(a)+1;
    //             userRef.collection('Musics').doc(currplayingmusicid).set({
    //                 timeplayed: b,
    //             })
    //             .then(() => {
    //                 repeattimesuccess();
    //                 console.log("Document successfully written!");
    //             })
    //             .catch((error) => {
    //                 console.error("Error writing document: ", error);
    //             });
    //         }).catch((err)=>{
    //             console.log(err.message);
    //         })
    //         userRef.get().then((doc)=>{
    //             const c = doc.data().totaltimeplayed;
    //             const d = parseInt(c)+1;
    //             db.collection('student').doc(currentuser).update({
    //                 totaltimeplayed: d,
    //             });
    //         })
    //     }else{
    //         console.log("update currplayingmusicid failed");
    //     }
    // };
    
    const handleClickNext = () => {
        console.log('click next')
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    };

    const handleClickPrev = () => {
        console.log('end')
        let currTrackId = (id-1) % playlists.length;
        if ((id-1)<=-1){
            currTrackId = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    };

    const handleEnd = () =>{
        console.log('track end')
        const currplayingmusicid = "'" + id + "'";
        updatetimeplayedtofirestore(currplayingmusicid);
        success();
        secondsuccess();
        let currTrackId = (id+1) % playlists.length;
        dispatch(setCurrentPlaying(playlists[currTrackId]));
    }
    
    
    return (
        <div className={"footer-player"}>
            <AudioPlayer
                autoPlay
                loop={null}
                // onSeeked={update_repeat_timeplayed}
                progressUpdateInterval={50}
                ref={audioElement}
                src={require("../assets/music/" + musicName).default}
                showSkipControls={true}
                showJumpControls={false}
                onClickNext={handleClickNext}
                onClickPrevious={handleClickPrev}
                onEnded={handleEnd}
                customProgressBarSection={
                    [
                        RHAP_UI.CURRENT_TIME,
                        <Marquee 
                        pauseOnHover={false}
                        gradient={true}
                        gradientWidth={40}
                        direction='right'
                        speed={60}
                    >
                        <div>
                            <Name name={"正在收聽的是 : "} className={"marqueenamelabel"} length={bookname.length}/>
                        </div>
                        <div>
                            <Name name={bookname} className={"marqueename"} length={bookname.length}/>
                        </div>
                        <div>
                            <Name name={page} className={"marqueename"} length={page.length}/>
                        </div>
                        <div>
                            <Name name={"請專心聆聽"} className={"marqueenamelabel"} length={page.length}/>
                        </div>
                        
                    </Marquee>,
                    RHAP_UI.DURATION,
                ]
                }
                customControlsSection={[
                    RHAP_UI.MAIN_CONTROLS,
                    RHAP_UI.VOLUME_CONTROLS,
                ]}
            />   
            <div>
                <ToastContainer
                position="top-center"
                autoClose={2000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                />
            </div>       
        </div>

    );
}


export default FooterMusicPlayer;