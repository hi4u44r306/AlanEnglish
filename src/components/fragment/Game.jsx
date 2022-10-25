import React, { useState } from 'react';
import Containerfull from './Containerfull';
import '../assets/scss/Game.scss';

export default function Game(){
    const questions = [
      {
        questionText: 'What is the capital of France?',
        answerOptions: [
          { answerText: 'New York', isCorrect: false },
          { answerText: 'London', isCorrect: false },
          { answerText: 'Paris', isCorrect: true },
          { answerText: 'Dublin', isCorrect: false },
        ],
      },
      {
        questionText: 'Who is CEO of Tesla?',
        answerOptions: [
          { answerText: 'Jeff Bezos', isCorrect: false },
          { answerText: 'Elon Musk', isCorrect: true },
          { answerText: 'Bill Gates', isCorrect: false },
          { answerText: 'Tony Stark', isCorrect: false },
        ],
      },
      {
        questionText: 'The iPhone was created by which company?',
        answerOptions: [
          { answerText: 'Apple', isCorrect: true },
          { answerText: 'Intel', isCorrect: false },
          { answerText: 'Amazon', isCorrect: false },
          { answerText: 'Microsoft', isCorrect: false },
        ],
      },
      {
        questionText: 'How many Harry Potter books are there?',
        answerOptions: [
          { answerText: '1', isCorrect: false },
          { answerText: '4', isCorrect: false },
          { answerText: '6', isCorrect: false },
          { answerText: '7', isCorrect: true },
        ],
      },
    ];
  
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [score, setScore] = useState(0);
  
    const handleAnswerOptionClick = (isCorrect) => {
      if (isCorrect) {
        setScore(score + 1);
      }
  
      const nextQuestion = currentQuestion + 1;
      if (nextQuestion < questions.length) {
        setCurrentQuestion(nextQuestion);
      } else {
        setShowScore(true);
      }
    };
  return (
    <Containerfull>
      <div className='gamecontainer'>
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
      </div>
    </Containerfull>
  )
}


