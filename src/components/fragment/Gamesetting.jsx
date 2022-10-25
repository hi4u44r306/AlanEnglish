import React from 'react'
import '../assets/scss/Game.scss'
import ReactDom from 'react-dom';

export default function Gamesetting({open, children, onClose}){
  if(!open) return null
  return ReactDom.createPortal(
    <>
        <div className='Overlay'/>
        <div className='Game'>
            <button onClick={onClose}>Close Game</button>
            {children}
        </div>
    </>,
    document.getElementById('portal')
  )
}
