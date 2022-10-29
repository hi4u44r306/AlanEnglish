import React, { useState, useEffect } from 'react';
import Containerfull from './Containerfull';
import '../assets/scss/Game.scss';
const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function Game(){
    // const questions = [
    //   {
    //     questionText: 'ABC',
    //     answerOptions: [
    //       { answerText: 'New York', isCorrect: false },
    //       { answerText: 'London', isCorrect: false },
    //       { answerText: 'Paris', isCorrect: true },
    //       { answerText: 'Dublin', isCorrect: false },
    //     ],
    //   },
    //   {
    //     questionText: 'What is the capital of France?',
    //     answerOptions: [
    //       { answerText: 'New York', isCorrect: false },
    //       { answerText: 'London', isCorrect: false },
    //       { answerText: 'Paris', isCorrect: true },
    //       { answerText: 'Dublin', isCorrect: false },
    //     ],
    //   },
    //   {
    //     questionText: 'Who is CEO of Tesla?',
    //     answerOptions: [
    //       { answerText: 'Jeff Bezos', isCorrect: false },
    //       { answerText: 'Elon Musk', isCorrect: true },
    //       { answerText: 'Bill Gates', isCorrect: false },
    //       { answerText: 'Tony Stark', isCorrect: false },
    //     ],
    //   },
    //   {
    //     questionText: 'The iPhone was created by which company?',
    //     answerOptions: [
    //       { answerText: 'Apple', isCorrect: true },
    //       { answerText: 'Intel', isCorrect: false },
    //       { answerText: 'Amazon', isCorrect: false },
    //       { answerText: 'Microsoft', isCorrect: false },
    //     ],
    //   },
    //   {
    //     questionText: 'How many Harry Potter books are there?',
    //     answerOptions: [
    //       { answerText: '1', isCorrect: false },
    //       { answerText: '4', isCorrect: false },
    //       { answerText: '6', isCorrect: false },
    //       { answerText: '7', isCorrect: true },
    //     ],
    //   },
    // ];
  
    // const [currentQuestion, setCurrentQuestion] = useState(0);
    // const [showScore, setShowScore] = useState(false);
    // const [score, setScore] = useState(0);
  
    // const handleAnswerOptionClick = (isCorrect) => {
    //   if (isCorrect) {
    //     setScore(score + 1);
    //   }
  
    //   const nextQuestion = currentQuestion + 1;
    //   if (nextQuestion < questions.length) {
    //     setCurrentQuestion(nextQuestion);
    //   } else {
    //     // setShowScore(true);
    //   }
    // };

    
    
    const [note, setNote] = useState(null);
    const [isListening, setIsListening ] = useState(false);
    const [savedNotes, setSavedNotes] = useState([]);
    
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
            console.log('Stopped MIc on Click')
          }
        }
        mic.onstart = () => {
          console.log("Mics on")
        }
        
        mic.onresult = event =>{
          const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('')
          console.log(transcript);
          setNote(transcript);
          mic.onerror = event => {
            console.log(event.error)
          }
        }
      }
      handleListen()
    },[isListening])
    

    const handleSaveNote = () => {
      setSavedNotes([...savedNotes, note])
      setNote('')
    }
  return (
    <>

      <Containerfull>
        <h3 className='gametitle'>測驗環節</h3>
        
        {/* <div className='gamecontainer'>
            {showScore ? (
            <div className='score-section'>
              總題數 {questions.length}題 / 你答對了 {score} 題
            </div>
          ) : (
            <>
              <div className='question-section'>
                <div className='question-count'>
                  <span>第 {currentQuestion + 1} 題</span> / {questions.length}
                </div>
                <div className='question-text'>{questions[currentQuestion].questionText}</div>
              </div>
              <div className='answer-section'>
                {questions[currentQuestion].answerOptions.map((answerOption) => (
                  <button className='gamebtn' onClick={() => handleAnswerOptionClick(answerOption.isCorrect)}>{answerOption.answerText}</button>
                ))}
              </div>
            </>
          )}
        </div> */}
          <div className='gamebox'>
            <div>
              <h2>Try to read this</h2>
              {isListening ? <span className='notes'> 🛑開始錄音 </span> : <span className='notes'> 停止錄音 </span>}
              <button className='recordbtn' onClick={handleSaveNote} disabled={!note}>儲存答案</button>
              <button className='recordbtn' onClick={() => setIsListening(prevState => !prevState)}>開始錄音 / 停止錄音</button>
              <p className='notes'>{note}</p>
            </div>
          </div>
          <div className='gamebox'>
            <div>
              <h2>Your answer</h2>
              {savedNotes.slice(0).reverse().map(n => (
                <p className='notes' key={n}>{n}</p>
              ))}
            </div>
          </div>
      </Containerfull>
    </>
  )
}


