import React, { useEffect, useState } from 'react'
import { rtdb } from './firebase-config';
import { onValue, ref } from 'firebase/database';
import './css/TradeTrack.scss';

function TradeTrack() {

    const [tradeTeams, setTradeTeams] = useState([]);

    useEffect(() => {
        const fetchTradeTeams = () => {
            const userRef = ref(rtdb, `Trade/TradeTeam`);
            onValue(userRef, snapshot => {
                if (snapshot.exists()) {
                    const teams = snapshot.val();
                    const teamsArray = Object.keys(teams).map(teamId => ({
                        id: teamId,
                        remainingMoney: teams[teamId].remainingMoney,
                        name: teams[teamId].name,
                        eggShares: teams[teamId].eggShares,
                        meatShares: teams[teamId].meatShares,
                        vegetableShares: teams[teamId].vegetableShares,
                        // Add other details you want to fetch
                    }));
                    setTradeTeams(teamsArray);
                }
            });
        };

        fetchTradeTeams();
    }, []);

    return (
        <div>
            <div className='tradetrack-title'>Trade Teams Remaining Money</div>
            <ul className='tradetrack-ul'>
                {tradeTeams.map(team => (
                    <li key={team.id} className='tradetrack-li'>
                        <div className='tradetrack-detail'>組別: {team.name}</div>
                        <div className='tradetrack-detail'>金錢: {team.remainingMoney} 元</div>
                        <div className='tradetrack-detail'>肉類: {team.meatShares}</div>
                        <div className='tradetrack-detail'>蔬菜: {team.vegetableShares}</div>
                        <div className='tradetrack-detail'>雞蛋: {team.eggShares}</div>
                        {/* Add other details as needed */}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default TradeTrack