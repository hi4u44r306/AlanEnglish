import React, { useState } from 'react';
import '../assets/scss/Game.scss';
import { toast, ToastContainer } from "react-toastify"
import Name from './Name';
import firebase from 'firebase/app';
import ContainerGame from './ContainerGame';
// import CheckMark from '../assets/img/checkmark.png'
// import Listening from '../assets/img/bars.svg'
// import RedSquare from '../assets/img/redsquare.png'
// import Mic from '../assets/img/microphone.png'
// import Next from '../assets/img/next.png'
// import axios from 'axios';

const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function Game({ open, onClose, bookname, pagename, musicName, questionsinmusic }) {
  const questions = [questionsinmusic];
  // const [transcript, setTranscript] = useState();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  // const [note, setNote] = useState(null);
  // const [isListening, setIsListening] = useState(false);
  // const [nextbtn, setNextbtn] = useState(true);
  // const realtimedb = firebase.database(); //realtime database
  const db = firebase.firestore(); // firestore
  const quizname = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g, "")

  const handleCardClick = (card) => {
    const nextQuestion = currentQuestion + 1;
    if (card.name === questions[0][currentQuestion].questionText && nextQuestion === questions[0].length) {
      finishnotification();
      uploadscore();
    } else {
      if (card.name === questions[0][currentQuestion].questionText) {
        success();
        // setNextbtn(false);
        // mic.stop();
        // setScore('')
        setTimeout(() => {
          if (nextQuestion < questions[0].length) {
            setCurrentQuestion(nextQuestion);
            // setNextbtn(true)
          }
        }, 1800);
      } else {
        error();
      }
    }

  };


  function uploadscore() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        db.collection('student').onSnapshot(() => {
          firebase.database().ref('student/' + user.uid + '/quiz/' + quizname).set({
            score: '通過',
          });
        });
      }
    });
  }

  // const getDifference = (s, t) => {
  //   let a = 0, b = 0; let charCode, i = 0;
  //   while (s[i]) {
  //     a ^= s.charCodeAt(i).toString(2);
  //     b ^= t.charCodeAt(i).toString(2);
  //     i++;
  //   };
  //   b ^= t.charCodeAt(i).toString(2);
  //   charCode = parseInt(a ^ b, 2);
  //   return String.fromCharCode(charCode);
  // };

  const finishnotification = () => {
    toast.success('測驗結束 視窗即將關閉', {
      className: "gamenotification",
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
      setCurrentQuestion(0);
    }, 2000);
  };

  // useEffect(() => {
  //   const handleListen = () => {
  //     if (isListening) {
  //       mic.start();
  //       mic.onend = () => {
  //         console.log('continue...')
  //         mic.start();
  //       }
  //       mic.onerror = event => {
  //         console.log(event.error)
  //       }
  //     } else {
  //       mic.stop();
  //       mic.onend = () => {
  //         console.log('Stopped Mic on Click')
  //       }
  //     }
  //     mic.onstart = () => {
  //       console.log("Mics on")
  //     }
  //     mic.onerror = event => {
  //       console.log(event.error)
  //     }

  //     mic.onresult = event => {
  //       const transcript = Array.from(event.results)
  //         .map(result => result[0])
  //         .map(result => result.transcript)
  //         .join('').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

  //       const stringSimilarity = require("string-similarity");
  //       const question = questions[0][currentQuestion].questionText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
  //       setTranscript(transcript, question);
  //       console.log("transcript : ", transcript)
  //       console.log("question : ", question)
  //       console.log(getDifference(transcript, question))
  //       const similarity = Math.round(stringSimilarity.compareTwoStrings(transcript, question) * 100);
  //       setScore(similarity);
  //       console.log(similarity);
  //       setNote(transcript);
  //       mic.onerror = event => {
  //         console.log(event.error)
  //       }
  //     }
  //   }
  //   handleListen()
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [isListening])

  const success = () => {
    toast.success('下一題', {
      className: "gamenotification",
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
  const error = () => {
    toast.error('選錯囉! 再試一次', {
      className: "gamenotification",
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
  // const handleAnswerOptionClick = () => {
  //   const nextQuestion = currentQuestion + 1;
  //   if (score >= 80 && nextQuestion === questions[0].length) {
  //     finishnotification();
  //     setCurrentQuestion(0);
  //     uploadscore();
  //   } else {
  //     if (score >= 80) {
  //       success();
  //       setNextbtn(false);
  //       mic.stop();
  //       setScore('')
  //       if (nextQuestion < questions[0].length) {
  //         setCurrentQuestion(nextQuestion);
  //         setNextbtn(true)
  //       } else {
  //       }
  //     } else {
  //       error();
  //     }
  //   }

  // };
  // const handleSaveNote = () => {
  //   mic.stop();
  //   setIsListening(false);
  //   setNextbtn(false)
  //   setNote('')
  // }
  const paragraph = "No matter how hard he tried, he couldn't give her a good explanation about what had happened. It didn't even really make sense to him. All he knew was that he froze at the moment and no matter how hard he tried to react, nothing in his body allowed him to move. It was as if he had instantly become a statue and although he could see what was taking place, he couldn't move to intervene. He knew that wasn't a satisfactory explanation even though it was the truth.";

  if (!open) return null
  return (
    <>
      <ContainerGame>
        <div className='Overlay' />
        <div className='gamebox'>
          <div className='gamebox2'>
            <div className='boxtitle'>
              <span className='closebtn' onClick={onClose}>❌</span>
              <Name name={bookname} className={"game-name"} />
              <Name name={pagename} className={"game-name"} />
              <div className="questionindex">第 {currentQuestion + 1} 題 / 共 {questions[0].length} 題</div>
            </div>
            <div className='questionbox'>
              <div className='questionsection'>
                <div className='題目'>Question :</div>
                <div className='questiontext'> {questions[0][currentQuestion].questionText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")}</div>
              </div>

              <div className='questionsection'>
                <div className='deckcontainer'>
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
                  {
                    !questions[0][currentQuestion].questiondeck || questions[0][currentQuestion].questiondeck.sort(() => Math.random() - 0.3).map((card) => (
                      <div className="deck" key={card.image} onClick={() => handleCardClick(card)}>
                        <img className='deckimage' src={require("../assets/img/" + card.image).default} alt="" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <HoverableWords text={paragraph} />
        </div>
      </ContainerGame>
    </>
  )
}


export function HoverableWords({ text }) {
  const [hoveredWord, setHoveredWord] = useState(null);
  const [openBoxes, setOpenBoxes] = useState({});

  const handleWordHover = (word) => {
    setHoveredWord(word);
  };

  const handleWordLeave = () => {
    setHoveredWord(null);
  };

  const handleButtonClick = (e, word) => {
    e.stopPropagation();
    setOpenBoxes((prevOpenBoxes) => {
      const newOpenBoxes = { ...prevOpenBoxes };
      newOpenBoxes[word] = !newOpenBoxes[word];
      return newOpenBoxes;
    });
  };

  const handleCloseBox = (word) => {
    setOpenBoxes((prevOpenBoxes) => {
      const newOpenBoxes = { ...prevOpenBoxes };
      delete newOpenBoxes[word];
      return newOpenBoxes;
    });
  };

  const regex = /\s+/;
  const words = text.split(regex);

  return (
    <span className="hoverable-paragraph">
      {words.map((word, index) => {
        if (word.trim() === '') {
          return <span key={index}> </span>;
        }

        const isHovered = word === hoveredWord;
        const isOpen = !!openBoxes[word];

        return (
          <span key={index}>
            <span
              className={`hoverable-word ${isHovered ? 'hovered' : ''}`}
              onClick={(e) => handleButtonClick(e, word)}
              onMouseEnter={() => handleWordHover(word)}
              onMouseLeave={() => handleWordLeave()}
            >
              {word}
              {isHovered && (
                <span className="word-box" style={{ display: isOpen ? 'block' : 'none' }}>
                  <div className="word-box-header">
                    <span className="word-box-title">{word}</span>
                    <button className="word-box-close" onClick={() => handleCloseBox(word)}>
                      X
                    </button>
                  </div>
                  <div className="word-box-content">
                    <p>{word} is a word.</p>
                    <p>It has some meaning.</p>
                    <div className="word-box-buttons">
                      <button className="word-box-button">Learn</button>
                      <button className="word-box-button">Know</button>
                    </div>
                  </div>
                </span>
              )}
              {' '}
            </span>
          </span>
        );
      })}
    </span>
  );
}






