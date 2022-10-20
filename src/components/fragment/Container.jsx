import React from 'react';
// import React, { useState } from 'react';
import '../assets/scss/Container.scss';
// import Game from './Game';

const Container = ({children}) => {
    // const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={"Container"}>
            {/* <button onClick={()=>setIsOpen(true)}>Open Game</button>
            <Game open={isOpen} onClose={()=>setIsOpen(false)}>
               <div>Game Time</div>
                <div>
                    Question 1
                    <button>
                        1. ABC
                    </button>
                    <button>
                        2. EFG
                    </button>
                    <button>
                        3. HIJ
                    </button>
                </div>
            </Game> */}
            {children}
        </div>
    );
}

export default Container;