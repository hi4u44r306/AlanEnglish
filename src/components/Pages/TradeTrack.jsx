import React, { useEffect, useState } from 'react';
import { rtdb } from './firebase-config';
import { onValue, ref } from 'firebase/database';
import './css/TradeTrack.scss';

function TradeTrack() {
    const [tradeTeams, setTradeTeams] = useState([]);
    const [totalMeatShares, setTotalMeatShares] = useState(0);
    const [totalVegetableShares, setTotalVegetableShares] = useState(0);
    const [totalEggShares, setTotalEggShares] = useState(0);







    useEffect(() => {
        const fetchTradeTeams = () => {

            const productRef = ref(rtdb, `Trade/New`);
            onValue(productRef, snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();

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
                                // 計算損益
                                total: (teams[teamId].meatShares * data.meat) + (teams[teamId].vegetableShares * data.vegetable) + (teams[teamId].eggShares * data.egg) + teams[teamId].remainingMoney - 1000
                            }));

                            // Sort teamsArray by team number (assuming team name contains the number)
                            teamsArray.sort((a, b) => {
                                const getTeamNumber = name => parseInt(name.match(/\d+/)[0], 10);
                                return getTeamNumber(a.name) - getTeamNumber(b.name);
                            });

                            setTradeTeams(teamsArray);

                            // Calculate totals
                            const totalMeat = teamsArray.reduce((acc, team) => acc + team.meatShares, 0);
                            const totalVegetable = teamsArray.reduce((acc, team) => acc + team.vegetableShares, 0);
                            const totalEgg = teamsArray.reduce((acc, team) => acc + team.eggShares, 0);

                            setTotalMeatShares(totalMeat);
                            setTotalVegetableShares(totalVegetable);
                            setTotalEggShares(totalEgg);
                        }
                    });
                }
            });


        };

        fetchTradeTeams();
    }, []);

    return (
        <div>
            <div className='tradetrack-title'>
                <a style={{ fontSize: 18, fontWeight: 700, marginRight: 10 }} href="/trade" alt="/trade" >返回Trade頁面</a>
                <a style={{ fontSize: 18, fontWeight: 700, marginRight: 10 }} href="/tradesignup" alt="/tradesignup" >註冊帳號</a>
                Trade Teams Remaining Money
            </div>
            <div className='tradetrack-list'>
                <ul className='tradetrack-ul'>
                    {tradeTeams.map(team => (
                        <li key={team.id} className='tradetrack-li'>
                            <div className='tradetrack-detail'>組別: {team.name}</div>
                            <div className='tradetrack-detail'>金錢: {team.remainingMoney} 元</div>
                            <div className='tradetrack-detail'>肉類: {team.meatShares}</div>
                            <div className='tradetrack-detail'>蔬菜: {team.vegetableShares}</div>
                            <div className='tradetrack-detail'>雞蛋: {team.eggShares}</div>
                            <div className='tradetrack-detail'>損益: {team.total}</div>
                        </li>
                    ))}
                </ul>
                <div className='tradetrack-conclude'>
                    <div>
                        總計
                    </div>
                    <div>
                        肉類: {totalMeatShares}
                    </div>
                    <div>
                        蔬菜: {totalVegetableShares}
                    </div>
                    <div>
                        雞蛋: {totalEggShares}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TradeTrack;
