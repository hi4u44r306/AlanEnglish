import React, { useState, useEffect } from 'react';
import Containerfull from './Containerfull';
import '../assets/scss/Game.scss';
const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function Game(){
    const questions = [
      {
        questionText: 'Apple.',
      },
      {
        questionText: 'Banana.',
      },
      {
        questionText: 'Car.',
      },
      {
        questionText: 'Dog.',
      },
      {
        questionText: 'Elephant.',
      },
    ];
  
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [note, setNote] = useState(null);
    const [isListening, setIsListening ] = useState(false);
    const [savedNotes, setSavedNotes] = useState([]);
    const [score, setScore] = useState();
    const [nextbtn, setNextbtn] = useState(true);
  
    const handleAnswerOptionClick = () => {
      if (score >= 80) {
        setNextbtn(false);
        mic.stop();
        setSavedNotes(' ')
        const nextQuestion = currentQuestion + 1;
        if (nextQuestion < questions.length) {
          setCurrentQuestion(nextQuestion);
          setNextbtn(true)
        } else {
        }
      }else{
        alert('再試一次')
      }
  
    };

    
    
    useEffect(()=>{
      const handleListen = () => {
        if(isListening){
          mic.start();
          mic.onend = () => {
            console.log('continue...')
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
          const question = questions[currentQuestion].questionText
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
    

    const handleSaveNote = () => {
      setSavedNotes(score);
      mic.stop();
      setIsListening(false);
      setNextbtn(false)
      setNote('')
    }
  return (
    <>

      <Containerfull>
        <h3 className='gametitle'>測驗環節</h3>
          <div className='gamebox'>
            <div>
              <div className='boxtitle'>
                <span>第 {currentQuestion + 1} 題</span> / 共{questions.length}題
              </div>
              <div className='boxtitle'>念念看 : {questions[currentQuestion].questionText}</div>
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


                <div className='gamenote'>你的回答 : {note}</div>
                <div className='gamenote' key={savedNotes}>分數 : {savedNotes}</div>
            </div>
          </div>
      </Containerfull>
    </>
  )
}


