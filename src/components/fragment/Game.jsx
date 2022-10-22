import React from 'react'
import { useState } from 'react';
import Containerfull from './Containerfull';
import Gamesetting from './Gamesetting';

const Game = () => {
    const [isOpen, setIsOpen] = useState(true);

  return (
    <Containerfull>
        <button onClick={()=>setIsOpen(true)}>open</button>
        <Gamesetting open={isOpen} onClose={()=>setIsOpen(false)} >
            <div>隨堂測驗</div>
            <button>1. a</button>
            <button>2. b</button>
            <button>3. c</button>
        </Gamesetting>
    </Containerfull>
  )
}

export default Game