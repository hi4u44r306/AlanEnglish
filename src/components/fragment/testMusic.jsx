import React from 'react';
import { useState, useEffect } from 'react';
import firebase from '../Pages/firebase'
import '../assets/scss/MusicCard.scss'

import Name from "./Name";
import {Skeleton} from "@material-ui/lab";
import Box from "@material-ui/core/Box";
import PlayCircleFilledWhiteIcon from "@material-ui/icons/PlayCircleFilledWhite";



export default function Todo({ todo, user }) {
  const [count, setCount] = useState(todo.count);

  const deleteTodo = () => {
    const todoRef = firebase.database().ref('User').child('Music').child(todo.id);
    todoRef.remove();
  };
  const updateCount = () => {
    const todoRef = firebase.database().ref('User').child('Music').child(todo.id);
      todoRef.update({
        count:count,
      });
  };


  const counter = () => {
    console.log(count);
    setCount(count+1);
    updateCount(count);
  };

  const [isHovered, setHovered] = useState(false);
  const [loaded,setLoaded] = useState(false);

  function handleResponse() {
      setHovered(!isHovered);
  }
  function handlePlay() {
    // dispatch(setCurrentPlaying(props.music))
    // dispatch(increaseTimesPlayed(props.music.id));
}
  useEffect(()=>{
    setLoaded(true)
  },[]);


  return (
    <div className={"music-card"}>
      {
                !loaded ?
                <div className={"Skeleton-top"}>
                    <Skeleton variant="rect" width={210} height={210} />
                    <Box pt={0.5}>
                        <Skeleton />
                        <Skeleton width="60%" />
                    </Box>
                </div>
                    :
                    <>
                        <div onClick={handlePlay}  className={"music-card-cover"} onMouseOver={handleResponse}>
                            <img src='src/components/assets/img/headphone.png' alt={''}/>
                            <div className="play-circle" onClick={counter}>
                                <PlayCircleFilledWhiteIcon/>
                            </div>
                        </div>
                        <div className="completebtn">
                          <button onClick={deleteTodo}>Delete</button>
                        </div>
                        <React.Fragment>
                          <div className='d-flex align-items-center'>
                            <h6 className={"song-name"}>聆聽次數:</h6>
                            <Name name={todo.count} className={"song-name"}/>
                          </div>
                          <Name name={todo.bookname} className={"song-name"}/>
                          <Name name={todo.page} className={"song-name"}/>
                        </React.Fragment>
                    </>
            }
    </div>
  );
}
