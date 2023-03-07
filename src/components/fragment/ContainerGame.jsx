import React from 'react';
import '../assets/scss/ContainerGame.scss';

const ContainerGame = ({ children }) => {
    return (
        <div className={"ContainerGame"}>
            {children}
        </div>
    );
}

export default ContainerGame;