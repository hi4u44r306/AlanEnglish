import React from 'react'
import Container from './Container'
import LeaderBoard from '../assets/img/LeaderBoard.png'
import '../assets/scss/Leaderboard.scss';

const Leaderboard = () => {
  return (
    <Container>
        <div>
            <h1>September Timeplayed LeaderBoard</h1>
            <div>
                <div>victor</div>
                <div>victor123</div>
                <div>victor456</div>
                <img className="leaderboardimg" src={LeaderBoard} alt=""/>
            </div>
        </div>
    </Container>
  )
}

export default Leaderboard