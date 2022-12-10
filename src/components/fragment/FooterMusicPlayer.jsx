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

    const [{ bookname, page , musicName}, setCurrTrack] = useState(music);
    const {playlists} = useSelector(state => state.musicReducer);
    const [currentuser,setCurrUser] = useState();
    const userId = firebase.auth().currentUser.uid;
    // const [totaltimeplayed,setTotaltimeplayed] = useState();
    // const currplayingmusicid = "'" + id + "'";
    const db = firebase.firestore(); // firestore
    const dispatch = useDispatch();
    const audioElement = useRef();
    const currentDate = new Date().toJSON().slice(0, 10);
    const currentMonth = new Date().toJSON().slice(0, 7);
    const userRef = db.collection('student').doc(currentuser); 

    const success = () =>  {
        toast.success(`聽力次數 + 1`,{
            className:"musicnotification",
            position: "top-center",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            progress: undefined,
            theme: "colored",
            });
        };

    useEffect(() => {
        setCurrTrack(music);
        // 每月1號重置所有播放次數//
        
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
       
//============================================================================================//

            userRef.get().then((doc) =>{
                if(doc.data().Resetallmusic === 'notupdated' || doc.data().Resetallmusic !== currentMonth+'alreadyupdated'){
                    userRef.set({
                        totaltimeplayed : 0,
                        currdatetimeplayed : 0,
                        Resetallmusic : currentMonth+'alreadyupdated',
                    },{merge: true})
                    firebase.database().ref('student/' + userId ).update({
                        totaltimeplayed : 0,
                    });
                    // for(let i = 0; i < 601; i++){      
                    //     let j = "'"+i+"'"
                    //     userRef.collection('Musics').doc(j).set({ // 在特定User中加入Musics集合，在Musics中加入id以及timeplayed
                    //         timeplayed : 0,
                    //     })        
                    // }
                    console.log('First time reset')
                }else{
                    console.log('This account is alreadyreset')
                }
            }).catch(() =>{
            })
           


            const dbRef = firebase.database().ref();
            
            dbRef.child("student").child(userId).child("totaltimeplayed").get().then((snapshot) => {
                const aaa = parseInt(snapshot.val())+1;
                dbRef.child("student").child(userId).update({
                    totaltimeplayed : aaa,
                });
            }).catch(() => {
                firebase.database().ref('student/' + userId ).update({
                    totaltimeplayed : 0,
                });
            });
            


            // 當使用者聽完一個音軌 推送Timestamp到firebase //
            userRef.update({ 
                onlinetime : currentDate,
                onlinemonth : currentMonth,
            })
            // 當使用者聽完一個音軌 推送Timestamp到firebase 結束 //

// //============================================================================================//

            // 檢查當天日期是否有聽 如果有就上傳資料到user doc 如果沒有就新增 //
            const checklisten = userRef.collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate)
            if(checklisten === true){
                console.log('no checklisten');
            }else{
                checklisten.get().then((doc)=>{
                    const aaa = doc.data().todaytotaltimeplayed
                    const bbb = parseInt(aaa)+1; ////+1 是因為非同步 舉例:在logfile中總播放次數是2 但是在用戶資料中播放次數是1 所以要同步的話要+1
                    userRef.set({
                        currdatetimeplayed: bbb,
                    }, {merge: true})
                })
                .catch((err) => err.message)
            }
            // 檢查當天日期是否有聽 如果有就上傳資料到user doc 如果沒有就新增 結束 //

// //============================================================================================//
            
//             // 當前音軌次數增加 //
//             userRef.collection('Musics').doc(currplayingmusicid).get().then((doc)=>{
//                 const a = doc.data().timeplayed;
//                 const b = parseInt(a)+1;
//                 userRef.collection('Musics').doc(currplayingmusicid).set({
//                     timeplayed: b,
//                     // gamescore: 100,
//                 })
//                 // setTimeout(function(){window.location = "/home/game";} ,500)
//             }).catch((err)=>{
//                 // userRef.collection('Musics').doc(currplayingmusicid).set({
//                 //     gamescore: 0,
//                 // })
//                 console.log(err.message);
//             })
//             // 當前音軌次數增加 結束 //

// //============================================================================================//
            
            /// 記錄檔中當月總次數 ///
            const usermonthlytimes = userRef.collection('Logfile').doc(currentMonth)
            usermonthlytimes.get().then((doc)=>{
                const abc = doc.data().currentMonthTotalTimes;
                const efg = parseInt(abc)+1;
                usermonthlytimes.update({
                    currentMonthTotalTimes : efg,
                })
            }).catch(()=>{
                usermonthlytimes.set({
                    currentMonthTotalTimes : 1,
                })
            })
            /// 記錄檔中當月總次數 結束 ///

// //============================================================================================//
            
            // 記錄檔中當天總次數計算 //
            const userdailytimes = userRef.collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate);
            userdailytimes.get().then((doc)=>{
                const abc = doc.data().todaytotaltimeplayed;
                const efg = parseInt(abc)+1;
                userdailytimes.update({
                    todaytotaltimeplayed : efg,
                })
            }).catch(()=>{
                userdailytimes.set({
                    todaytotaltimeplayed : 1,
                })
            })
            // 記錄檔中當天總次數計算 結束 //

// //============================================================================================//
            
//             // 記錄檔中的當前音軌當天次數增加 //
//             const logfileRef = userRef.collection('Logfile').doc(currentMonth).collection(currentMonth).doc(currentDate).collection(currplayingmusicid).doc(currplayingmusicid)
//             logfileRef.get().then((doc)=>{///如果Firebase 有這筆資料播放次數 + 1///
//                 const a = doc.data().timeplayed;
//                 const b = parseInt(a)+1;  
//                 logfileRef.update({
//                     timeplayed: b,
//                     gamescore : 100,
//                 }).then(() => {
//                     console.log(currentDate, " id: ", currplayingmusicid , 'time played update', b);
//                 })
//             }).catch(() => { ///如果Firebase 中沒有這筆資料則新增///
//                 const newdaytimeplayed = 1;
//                 const newgamescore = 0;
//                 logfileRef.set({
//                     timeplayed: newdaytimeplayed,
//                     gamescore: newgamescore,
//                 }).then(() =>{
//                     console.log(currentDate, "id :", currplayingmusicid ,'new update');
//                 })
//             });
//             // 記錄檔中的當前音軌當天次數增加 結束 //
                       
// //============================================================================================//

            // 所有音軌總次數增加 //
            userRef.get().then((doc)=>{  
                const c = doc.data().totaltimeplayed;
                const d = parseInt(c)+1;
                userRef.update({
                    totaltimeplayed: d,
                })
            })
            // 所有音軌總次數增加 結束 //

// //============================================================================================//
//         }else{
//             console.log("update currplayingmusicid failed");
//         }
        

    };

    const currentTrack = playlists.findIndex(obj => obj.musicName=== musicName)
    const handleClickNext = () => {
        console.log('Next Track')
        let abc = currentTrack + 1;
        if ((currentTrack+1)>=playlists.length){
            abc = 0;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleClickPrev = () => {
        console.log('Previous Track')
        let abc = currentTrack - 1;
        if ((currentTrack-1)<=-1){
            abc = playlists.length - 1;
        }
        dispatch(setCurrentPlaying(playlists[abc]));
    };

    const handleEnd = () => {
        console.log('Track End')
        let abc = currentTrack + 1;
        // if ((currentTrack+1)<=playlists.length){
        //     abc = 0;
        // }
        success();
        updatetimeplayedtofirestore();
        dispatch(setCurrentPlaying(playlists[abc]));
    }

    
   
    // const handleClickNext = () => {
    //     console.log('click next')
    //     let currTrackId = (id+1) % playlists.length;
    //     dispatch(setCurrentPlaying(playlists[currTrackId]));
    // };


    // const handleEnd = () =>{
    //     console.log('track end')
    //     const currplayingmusicid = "'" + id + "'";
    //     updatetimeplayedtofirestore(currplayingmusicid);
    //     success();
    //     // secondsuccess();
    //     let currTrackId = (id+1) % playlists.length;
    //     dispatch(setCurrentPlaying(playlists[currTrackId]));
    // }
    
    
    return (
        <div className={"footer-player"}>
            <AudioPlayer
                autoPlay
                loop={null}
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