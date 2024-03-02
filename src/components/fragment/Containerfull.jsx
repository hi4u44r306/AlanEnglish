import React, { useEffect, useState } from 'react';
import '../assets/scss/Containerfull.scss';
import StudentNavigationBar from './StudentNavigationBar';
import { useSelector } from 'react-redux';
import FooterMusicPlayer from './FooterMusicPlayer';

const Containerfull = ({ children }) => {

    const { playing, curr_margin } = useSelector(state => state.musicReducer);
    const [currMusic, setCurrMusic] = useState(null);
    useEffect(() => {
        setCurrMusic(playing)
    }, [playing])
    return (
        <>
            <div style={{
                position: 'fixed',
                top: 0,
                width: '100%',
                zIndex: 100,
                height: '10vh',
                backgroundColor: 'white'
            }}>
                <StudentNavigationBar />
            </div>
            <div style={{
                marginTop: '10vh',
                marginBottom: curr_margin,
            }}>
                {children}
            </div>
            <div style={{
                position: 'fixed',
                bottom: 0,
                width: '100%',
                zIndex: 100,
            }}>
                <React.Fragment>
                    {
                        currMusic &&
                        (
                            <>
                                <FooterMusicPlayer music={currMusic} />
                                {/* <BigScreen music={currMusic} /> */}
                            </>
                        )
                    }
                </React.Fragment>
            </div>
        </>
    );
}

export default Containerfull;