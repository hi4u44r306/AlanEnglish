import React, { useEffect, useState } from 'react';
import './css/Trade.scss';
import { rtdb } from './firebase-config';
import { child, onValue, ref } from 'firebase/database';
import meatimg from '../assets/img/meat.png';
import vegetableimg from '../assets/img/vegetable.png';
import eggimg from '../assets/img/egg.png';
import Marquee from "react-fast-marquee";
import { BsArrowUpCircleFill } from "react-icons/bs";
import { BsArrowDownCircleFill } from "react-icons/bs";

function Trade() {
    const size = 24;
    const [meat, setMeat] = useState();
    const [vegetable, setVegetable] = useState();
    const [egg, setEgg] = useState();
    const [newmeat, setNewMeat] = useState();
    const [newvegetable, setNewVegetable] = useState();
    const [newegg, setNewEgg] = useState();
    const [news, setNews] = useState();
    const [meatShares, setMeatShares] = useState('');
    const [vegetableShares, setVegetableShares] = useState('');
    const [eggShares, setEggShares] = useState('');
    const [unusedMoney, setUnusedMoney] = useState('');
    const [currentdate] = useState(getCurrentDate());
    const dbRef = ref(rtdb);

    function getCurrentDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    useEffect(() => {
        const TradeRef = child(dbRef, `Trade`);

        const Original = onValue(TradeRef, (snapshot) => {
            if (snapshot.exists()) {
                setMeat(snapshot.val().Original.meat);
                setVegetable(snapshot.val().Original.vegetable);
                setEgg(snapshot.val().Original.egg);
                setNewMeat(snapshot.val().New.meat);
                setNewVegetable(snapshot.val().New.vegetable);
                setNewEgg(snapshot.val().New.egg);
                setNews(snapshot.val().News)
            }
        }, (error) => {
            console.error("Error fetching complete value:", error);
        });

        return () => {
            Original();
        };

    }, [dbRef]);

    const handleMeatSharesChange = (e) => setMeatShares(e.target.value);
    const handleVegetableSharesChange = (e) => setVegetableShares(e.target.value);
    const handleEggSharesChange = (e) => setEggShares(e.target.value);
    const handleUnusedMoneyChange = (e) => setUnusedMoney(e.target.value);

    const calculateCurrentValue = () => {
        const meatValue = (parseFloat(meatShares) || 0) * (parseFloat(newmeat) || 0);
        const vegetableValue = (parseFloat(vegetableShares) || 0) * (parseFloat(newvegetable) || 0);
        const eggValue = (parseFloat(eggShares) || 0) * (parseFloat(newegg) || 0);
        return meatValue + vegetableValue + eggValue + (parseFloat(unusedMoney) || 0);
    };

    const initialInvestment = 1000;
    const currentValue = calculateCurrentValue();
    const profit = currentValue - initialInvestment;

    let profitMessage;
    if (profit > 0) {
        profitMessage = `賺了 ${profit} 元`;
    } else if (profit === 0) {
        profitMessage = "沒賺沒賠";
    } else {
        profitMessage = `賠了 ${Math.abs(profit)} 元`;
    }

    return (
        <div className='Trade'>
            <div className="container">
                <div className="title">
                    理財達人 投資遊戲
                </div>
                <div className='game-rule'>
                    這個投資遊戲是為了讓小朋友了解投資的基本概念和風險設計的。投資有賺有賠，不要太在意結果，放輕鬆享受遊戲的過程吧！
                </div>
                <div className='news'>
                    <Marquee
                        pauseOnHover={false}
                        direction='right'
                        speed={60}
                    >
                        <div>
                            {news}
                        </div>
                    </Marquee>
                </div>
                <div className="trade-list">
                    <div className='trade-title'>初始購買價格</div>
                    <div className='trade-item-container'>
                        <div className="trade-item">
                            <img className='trade-img' src={meatimg} alt='meat' />
                            <div className="trade-name">肉類</div>
                            <div className="trade-price">{meat} 元</div>
                        </div>
                        <div className="trade-item">
                            <img className='trade-img' src={vegetableimg} alt='vegetable' />
                            <div className="trade-name">蔬菜</div>
                            <div className="trade-price">{vegetable} 元</div>
                        </div>
                        <div className="trade-item">
                            <img className='trade-img' src={eggimg} alt='egg' />
                            <div className="trade-name">雞蛋</div>
                            <div className="trade-price">{egg} 元</div>
                        </div>
                    </div>
                </div>
                <div className="trade-list">
                    <div className='trade-title'>{currentdate} 的價格</div>
                    <div className='trade-item-container'>
                        <div className="trade-item">
                            <img className='trade-img' src={meatimg} alt='meat' />
                            <div className="trade-name">肉類</div>
                            <div className="trade-price">
                                {newmeat} 元
                                {newmeat > meat && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                {newmeat < meat && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                            </div>
                        </div>
                        <div className="trade-item">
                            <img className='trade-img' src={vegetableimg} alt='vegetable' />
                            <div className="trade-name">蔬菜</div>
                            <div className="trade-price">
                                {newvegetable} 元
                                {newvegetable > vegetable && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                {newvegetable < vegetable && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                            </div>
                        </div>
                        <div className="trade-item">
                            <img className='trade-img' src={eggimg} alt='egg' />
                            <div className="trade-name">雞蛋</div>
                            <div className="trade-price">
                                {newegg} 元
                                {newegg > egg && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                {newegg < egg && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="loss-profit-calculation">
                    <div className="title">損益試算表</div>
                    <div className="input-group">
                        <label>肉類</label>
                        <input type="number" placeholder='請輸入數字' value={meatShares === '' ? '' : meatShares} onChange={handleMeatSharesChange} />
                    </div>
                    <div className="input-group">
                        <label>蔬菜</label>
                        <input type="number" placeholder='請輸入數字' value={vegetableShares === '' ? '' : vegetableShares} onChange={handleVegetableSharesChange} />
                    </div>
                    <div className="input-group">
                        <label>雞蛋</label>
                        <input type="number" placeholder='請輸入數字' value={eggShares === '' ? '' : eggShares} onChange={handleEggSharesChange} />
                    </div>
                    <div className="input-group">
                        <label>沒有用到的錢</label>
                        <input type="number" placeholder='請輸入數字' value={unusedMoney === '' ? '' : unusedMoney} onChange={handleUnusedMoneyChange} />
                    </div>
                    <div className="summary">
                        <div>初始金額 1000 元</div>
                        <div>試算金額 {currentValue} 元</div>
                        <div className="profit-message">試算結果 : {profitMessage}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Trade;
