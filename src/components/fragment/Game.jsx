import React from 'react'
import { useState } from 'react';
import Containerfull from './Containerfull';
import Gamesetting from './Gamesetting';

const Game = () => {
    const [isOpen, setIsOpen] = useState(false);

  return (
    <Containerfull>
        <button onClick={()=>setIsOpen(true)}>open</button>
        <Gamesetting open={isOpen} onClose={()=>setIsOpen(false)}>
            <div>Test</div>
        </Gamesetting>
    </Containerfull>
  )
}

export default Game