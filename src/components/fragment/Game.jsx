import React, { useState, useEffect } from 'react';
import Containerfull from './Containerfull';
import '../assets/scss/Game.scss';
import { toast, ToastContainer} from "react-toastify"
import Name from './Name';

const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function Game({open, onClose, bookname, pagename, questionsinmusic}){

    const questions = [questionsinmusic]
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [note, setNote] = useState(null);
    const [isListening, setIsListening ] = useState(false);
    const [score, setScore] = useState();
    const [nextbtn, setNextbtn] = useState(true);
  

    
    const finishnotification = () =>  {
      toast.success('恭喜你完成測驗 測驗視窗即將關閉',{
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
      setTimeout(() => {
        onClose();
      }, 2500);
    };

    useEffect(()=>{
      const handleListen = () => {
        if(isListening){
          mic.start();
          mic.onend = () => {
            console.log('continue...')
            mic.start();
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
          .join('')
          console.log(transcript);
          const stringSimilarity = require("string-similarity");
          const question = questions[0][currentQuestion].questionText
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
      toast.success('太棒了',{
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
      toast.error('正確率未超過80%，再試一次',{
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
    const handleAnswerOptionClick = () => {
      const nextQuestion = currentQuestion + 1;
      if (score >= 80 && nextQuestion === questions[0].length) {
        finishnotification();
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
              position="bottom-center"
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
              <div className='題目'>題目 :</div>
              <div className='questiontext'> {questions[0][currentQuestion].questionText}</div>
              {/* 電腦版顯示 */}
                <div className="computer-btncontainer">
                  <button className='btn submitanswerbtn' onClick={handleSaveNote} disabled={!note}>提交答案 ✅</button>
                  {isListening ? 
                    <button className='stoprecordbtn' onClick={() => setIsListening(prevState => !prevState)}> 點這裡暫停 🟥 </button> 
                    : 
                    <button className='recordingbtn' onClick={() => setIsListening(prevState => !prevState)}> 點這裡開始錄音 🎙️</button>
                  }
                  <button className='btn nextquestionbtn' onClick={handleAnswerOptionClick} disabled={nextbtn}>下一題 ⏭️</button>
                </div>

              {/* 手機版顯示 */}
                <div className="mobile-btncontainer">
                  <button className='btn submitanswerbtn' onClick={handleSaveNote} disabled={!note}>✅</button>
                  {isListening ? 
                    <button className='stoprecordbtn' onClick={() => setIsListening(prevState => !prevState)}>🟥 </button> 
                    : 
                    <button className='recordingbtn' onClick={() => setIsListening(prevState => !prevState)}>🎙️</button>
                  }
                  <button className='btn nextquestionbtn' onClick={handleAnswerOptionClick} disabled={nextbtn}>⏭️</button>
                </div>


                {/* <div className='gamenote'>你的回答 : {note}</div> */}
                <div className='gamenote' key={score}>正確率 : {score}%</div>
            </div>   
          </div>
        </Containerfull>
      </>
  )
}

