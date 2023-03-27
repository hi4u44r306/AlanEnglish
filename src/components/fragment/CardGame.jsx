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

const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition
const mic = new SpeechRecognition()
mic.continous = true
mic.interimResults = true
mic.lang = 'en-US'

export default function CardGame({ open, onClose, bookname, pagename, musicName, questionsinmusic, booktext }) {
  // const [transcript, setTranscript] = useState();
  // const [note, setNote] = useState(null);
  // const [isListening, setIsListening] = useState(false);
  // const [nextbtn, setNextbtn] = useState(true);
  // const realtimedb = firebase.database(); //realtime database
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const db = firebase.firestore(); // firestore
  const quizname = musicName.substring(musicName.indexOf('/') + 1).replace(/[.mp3]/g, "")
  const questions = [questionsinmusic];

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
    toast.success('答對了 ! 下一題', {
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

        </div>
      </ContainerGame>
    </>
  )
}








