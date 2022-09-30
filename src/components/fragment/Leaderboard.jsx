import React from 'react'
import Container from './Container'
import LeaderBoard from '../assets/img/LeaderBoard.png'
import '../assets/scss/Leaderboard.scss';

const Leaderboard = () => {
  return (
    <Container>
        <div>
          <div className='leaderboardcontainer'>
            <div className='firstpart'>
              <h3 className='leaderboardtitle'>Timeplayed LeaderBoard</h3>
              <div className='leaderboardname'>
                  <div>victor</div>
                  <div>victor123</div>
                  <div>victor456</div>
              </div>
              <div>
                <img className="leaderboardimg" src={LeaderBoard} alt=""/>
              </div>
            </div>
            <div className='secondpart'>
            <h3>Timeplayed LeaderBoard</h3>
              <div className='leaderboardname'>
                  <div>victor</div>
                  <div>victor123</div>
                  <div>victor456</div>
              </div>
              <div>
                <img className="leaderboardimg" src={LeaderBoard} alt=""/>
              </div>
            </div>

          </div>
        </div>
    </Container>
  )
}

export default Leaderboard