import React, { useState, useEffect } from 'react';
import Containerfull from './Containerfull';
import '../assets/scss/Game.scss';
import { toast, ToastContainer} from "react-toastify"
import Name from './Name';
import CheckMark from '../assets/img/checkmark.png'
import Listening from '../assets/img/bars.svg'
// import RedSquare from '../assets/img/redsquare.png'
import Mic from '../assets/img/microphone.png'
import Next from '../assets/img/next.png'
import firebase from 'firebase/app';

const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function Game({open, onClose, bookname, pagename, musicName, questionsinmusic}){

    const questions = [questionsinmusic]
    const [transcript, setTranscript] = useState();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [note, setNote] = useState(null);
    const [isListening, setIsListening ] = useState(false);
    const [score, setScore] = useState();
    const [nextbtn, setNextbtn] = useState(true);
    // const realtimedb = firebase.database(); //realtime database
    const db = firebase.firestore(); // firestore
    const abc = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g,"")

    function uploadscore() {
      firebase.auth().onAuthStateChanged(user => { //從firestore取得student 集合中的登入中的useruid
        if(user){
            db.collection('student').onSnapshot(snapshot =>{
                firebase.database().ref('student/' + user.uid + '/quiz/' + abc ).set({
                  score: '通過',
                });
            });
        }else{
        }
      });
    }

    const getDifference = (s, t) => {
      let a = 0, b = 0; let charCode, i = 0;
      while(s[i]){
         a ^= s.charCodeAt(i).toString(2);
         b ^= t.charCodeAt(i).toString(2);
         i++;
      };
      b^=t.charCodeAt(i).toString(2);
      charCode = parseInt(a^b,2);
      return String.fromCharCode(charCode);
   };
    
    const finishnotification = () =>  {
      toast.success('測驗結束 視窗即將關閉',{
        className:"gamenotification",
        // position: "top-center",
        autoClose: 1500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    };

    useEffect(()=>{
      const handleListen = () => {
        if(isListening){
          mic.start();
          mic.onend = () => {
            console.log('continue...')
            mic.start();
          }
          mic.onerror = event => {
            console.log(event.error)
          }
        }else{
          mic.stop();
          mic.onend = () => {
            console.log('Stopped Mic on Click')
          }
        }
        mic.onstart = () => {
          console.log("Mics on")
        }
        mic.onerror = event => {
          console.log(event.error)
        }
        
        mic.onresult = event =>{
          const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");

          const stringSimilarity = require("string-similarity");
          const question = questions[0][currentQuestion].questionText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"");
          setTranscript(transcript,question);
          console.log("transcript : ",transcript)
          console.log("question : ",question)
          console.log(getDifference(transcript,question))
          const similarity = Math.round(stringSimilarity.compareTwoStrings(transcript, question)*100);
          setScore(similarity);
          console.log(similarity);
          setNote(transcript);
          mic.onerror = event => {
            console.log(event.error)
          }
        }
      }
      handleListen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[isListening])
    
    const success = () =>  {
      toast.info('下一題',{
        className:"gamenotification",
        position: "top-center",
        autoClose: 1500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        });
      };
    const error = () =>  {
      toast.error('低於80%，再試一次',{
        className:"gamenotification",
        // position: "top-center",
        autoClose: 1500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
        });
      };
    const handleAnswerOptionClick = () => {
      const nextQuestion = currentQuestion + 1;
      if (score >= 80 && nextQuestion === questions[0].length) {
        finishnotification();
        setCurrentQuestion(0);
        uploadscore();
      }else{
        if (score >= 80) {
          success();
          setNextbtn(false);
          mic.stop();
          setScore('')
          if (nextQuestion < questions[0].length) {
            setCurrentQuestion(nextQuestion);
            setNextbtn(true)
          } else {
          }
        }else{
          error();
        }
      }
  
    };
    const handleSaveNote = () => {
      mic.stop();
      setIsListening(false);
      setNextbtn(false)
      setNote('')
    }
    if (!open) return null
    return(
      <>
        <Containerfull>
          <div className='Overlay'/>
          <div className='gamebox'>
            <div>
              <ToastContainer
              // className="gamenotification"
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
            <div className='boxtitle'>
              <span className='closebtn' onClick={onClose}>❌</span>
              <Name name={bookname} className={"game-name"}/>
              <Name name={pagename} className={"game-name"}/>
              <div className="questionindex">第 {currentQuestion + 1} 題 / 共 {questions[0].length} 題</div>
            </div>
            <div className='questionbox'>
              <div className='questionsection'>
                <div className='題目'>Question :</div>
                <div className='questiontext'> {questions[0][currentQuestion].questionText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g,"")}</div>
              </div>
              <div className='questionsection'>
                <div className='題目'>Your Answer :</div>
                <div className='questiontext'> {transcript || "------"}</div>
              </div>
              {/* 電腦版顯示 */}
                <div className="computer-btncontainer">
                  <button className='btn submitanswerbtn' onClick={handleSaveNote} disabled={!note}><span>提交答案</span> <img style={{ width: 22, marginLeft: 10 , marginBottom: 2, }} src={CheckMark} alt="checkmark"/></button>
                  {isListening ? 
                    <button className='stoprecordbtn' onClick={() => setIsListening(prevState => !prevState)}><span>Recording</span> <img style={{ width: 22, marginLeft: 2 , marginBottom: 5, }} src={Listening} alt="redsquare"/></button> 
                    : 
                    <button className='recordingbtn' onClick={() => setIsListening(prevState => !prevState)}>
                    <span>Start Recording</span> <svg class="goxjub" focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285f4" d="m12 15c1.66 0 3-1.31 3-2.97v-7.02c0-1.66-1.34-3.01-3-3.01s-3 1.34-3 3.01v7.02c0 1.66 1.34 2.97 3 2.97z"></path><path fill="#34a853" d="m11 18.08h2v3.92h-2z"></path><path fill="#fbbc05" d="m7.05 16.87c-1.27-1.33-2.05-2.83-2.05-4.87h2c0 1.45 0.56 2.42 1.47 3.38v0.32l-1.15 1.18z"></path><path fill="#ea4335" d="m12 16.93a4.97 5.25 0 0 1 -3.54 -1.55l-1.41 1.49c1.26 1.34 3.02 2.13 4.95 2.13 3.87 0 6.99-2.92 6.99-7h-1.99c0 2.92-2.24 4.93-5 4.93z"></path></svg> 
                    {/* <img style={{ width: 25, marginLeft: 2 , marginBottom: 5, }} src={Mic} alt="mic"/> */}
                    </button>
                  }
                  <button className='btn nextquestionbtn' onClick={handleAnswerOptionClick} disabled={nextbtn}><span>下一題</span> <img style={{ width: 22, marginLeft: 2 , marginBottom: 5, }} src={Next} alt="mic"/></button>
                </div>

              {/* 手機版顯示 */}
                <div className="mobile-btncontainer">
                  <button className='btn submitanswerbtn' onClick={handleSaveNote} disabled={!note}><img style={{ width: 30 }} src={CheckMark} alt="checkmark"/></button>
                  {isListening ? 
                    <button className='stoprecordbtn' onClick={() => setIsListening(prevState => !prevState)}><img style={{ width: 30 }} src={Listening} alt="redsquare"/> </button> 
                    : 
                    <button className='recordingbtn' onClick={() => setIsListening(prevState => !prevState)}><img style={{ width: 30 }} src={Mic} alt="mic"/></button>
                  }
                  <button className='btn nextquestionbtn' onClick={handleAnswerOptionClick} disabled={nextbtn}><img style={{ width: 30 }} src={Next} alt="mic"/></button>
                </div>


                {/* <div className='gamenote'>你的回答 : {note}</div> */}
                <div className='gamenote' key={score}>正確率 : {score}%</div>
                
            </div>   
          </div>
        </Containerfull>
      </>
  )
}

