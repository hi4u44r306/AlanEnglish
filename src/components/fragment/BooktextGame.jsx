import React, { useState } from 'react';
import '../assets/scss/Game.scss';
import Name from './Name';
import ContainerGame from './ContainerGame';
// import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';

export default function BooktextGame({ open, onClose, bookname, pagename, booktext }) {

  const paragraph = `${booktext}`;

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
            </div>
            <HoverableWords text={paragraph} />
          </div>

        </div>
      </ContainerGame>
    </>
  )
}

export function HoverableWords({ text }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedWord, setSelectedWord] = useState("");

  function generateAudio(text) {
    const utterance = new SpeechSynthesisUtterance();
    utterance.text = text;
    utterance.lang = 'en-US';
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => voice.name === 'Google US English');
    speechSynthesis.speak(utterance);
  }

  const regex = /\s+/;
  const words = text.split(regex);

  const handleWordHover = (word) => {
    setSelectedWord(word);
    setShowTooltip(true);
  };

  const handleTooltipClose = () => {
    setShowTooltip(false);
  };

  return (
    <div className="paragraph-container">
      {showTooltip && (
        <div className="wordbox">
          <div className="close-header">
            <button className="close-btn" onClick={handleTooltipClose}>
              X
            </button>
          </div>
          <div className="tooltip-header">
            <div className="tooltip-title"> {selectedWord}</div>

            {/* <VolumeUpRoundedIcon className="listen-btn" onClick={() => generateAudio(selectedWord)} /> */}
            <button className="listen-btn" onClick={() => generateAudio(selectedWord)}>
              VolumeUpRoundedIcon
            </button>
          </div>
        </div>
      )}
      {words.map((word, index) => (
        <React.Fragment key={index}>
          {index > 0 && " "}
          <span className="word" onClick={() => handleWordHover(word)}>
            {word}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};








