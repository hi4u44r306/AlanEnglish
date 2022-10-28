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
      handleListen()
    },)
    
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

    const handleSaveNote = () => {
      setSavedNotes([...savedNotes, note])
      setNote('')
    }

  return (
    <>
    <h1>Game Section</h1>
      <Containerfull>
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
        <div className='box'>
          <h2>Your answer</h2>
          {isListening ? <span>🎤</span>: <span>🛑🎤</span>}
          <button onClick={handleSaveNote} disabled={!note}>Save Note</button>
          <button onClick={() => setIsListening(prevState => !prevState)}>Start / Stop</button>
          <p>{note}</p>
        </div>
        <div className='box'>
          <h2>Notes</h2>
          {savedNotes.map(n => (
            <p key={n}>{n}</p>
          ))}
        </div>
      </Containerfull>
    </>
  )
}


