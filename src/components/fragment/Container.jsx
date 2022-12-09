import React from 'react';
import '../assets/scss/Container.scss';
// import Banner from '../assets/banner/banner03.svg'

const Container = ({children}) => {
    return (
        <div className={"Container"}>
            {/* <img className='banner' src={Banner} alt=""/> */}
            {/* <div className='wavesection'>
                <div className='wave wave1'></div>
                <div className='wave wave2'></div>
                <div className='wave wave3'></div>
                <div className='wave wave4'></div>
            </div> */}
            {children}
        </div>
    );
}

export default Container;