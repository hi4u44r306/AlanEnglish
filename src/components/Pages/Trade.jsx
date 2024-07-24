import React, { useEffect, useState } from 'react';
import './css/Trade.scss';
import { authentication, rtdb } from './firebase-config';
import { child, onValue, ref } from 'firebase/database';
import meatimg from '../assets/img/meat.png';
import vegetableimg from '../assets/img/vegetable.png';
import eggimg from '../assets/img/egg.png';
import Marquee from "react-fast-marquee";
import { BsArrowUpCircleFill, BsArrowDownCircleFill } from "react-icons/bs";
import { onAuthStateChanged } from 'firebase/auth';
import OrderPage from './OrderPage';

function Trade() {
    const size = 24;
    const [data, setDate] = useState({});
    const [meat, setMeat] = useState();
    const [vegetable, setVegetable] = useState();
    const [egg, setEgg] = useState();
    const [newmeat, setNewMeat] = useState();
    const [newvegetable, setNewVegetable] = useState();
    const [newegg, setNewEgg] = useState();
    const [news, setNews] = useState();
    const [unusedMoney, setUnusedMoney] = useState(1000);
    const [showOrderPage, setShowOrderPage] = useState(false);
    const [userStocks, setUserStocks] = useState({ meat: 0, vegetable: 0, egg: 0 });
    const dbRef = ref(rtdb);

    function getCurrentDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    useEffect(() => {
        const fetchData = () => {
            onAuthStateChanged(authentication, user => {
                if (user) {
                    const userRef = ref(rtdb, `Trade/TradeTeam/${user.uid}`);
                    onValue(userRef, snapshot => {
                        if (snapshot.exists()) {
                            const data = snapshot.val();
                            setDate(data);
                            setUserStocks({
                                meat: data.meatShares || 0,
                                vegetable: data.vegetableShares || 0,
                                egg: data.eggShares || 0
                            });
                        }
                    });
                }
            });
        };

        fetchData();
    }, []);

    useEffect(() => {
        const tradeRef = child(dbRef, 'Trade');
        const handleData = onValue(tradeRef, snapshot => {
            if (snapshot.exists()) {
                const tradeData = snapshot.val();
                setMeat(tradeData.Original.meat);
                setVegetable(tradeData.Original.vegetable);
                setEgg(tradeData.Original.egg);
                setNewMeat(tradeData.New.meat);
                setNewVegetable(tradeData.New.vegetable);
                setNewEgg(tradeData.New.egg);
                setNews(tradeData.News);
            }
        });

        return () => {
            handleData();
        };
    }, [dbRef]);

    const handleOrderClick = () => {
        setShowOrderPage(true);
    };

    const handleOrderClose = () => {
        setShowOrderPage(false);
    };

    return (
        <div className='Trade'>
            <div className="container">
                {showOrderPage ? (
                    <OrderPage
                        meat={newmeat}
                        vegetable={newvegetable}
                        egg={newegg}
                        unusedMoney={unusedMoney}
                        setUnusedMoney={setUnusedMoney}
                        handleOrderClose={handleOrderClose}
                        userStocks={userStocks}
                        setUserStocks={setUserStocks}
                    />
                ) : (
                    <>
                        <div className="title">
                            理財達人 投資遊戲
                        </div>
                        <div className='userinfo'>
                            <div className='info'>
                                組別 : 第{data.name}組
                            </div>
                            <div className='info'>
                                金錢 : ${data.remainingMoney}
                            </div>
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
                            <div className='trade-title'>{getCurrentDate()} 的價格</div>
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
                        <div className="user-stocks">
                            <div className="stock-item">
                                <img className='trade-img' src={meatimg} alt='meat' />
                                <div className="stock-name">肉類</div>
                                <div className="stock-quantity">擁有: {userStocks.meat} 份</div>
                            </div>
                            <div className="stock-item">
                                <img className='trade-img' src={vegetableimg} alt='vegetable' />
                                <div className="stock-name">蔬菜</div>
                                <div className="stock-quantity">擁有: {userStocks.vegetable} 份</div>
                            </div>
                            <div className="stock-item">
                                <img className='trade-img' src={eggimg} alt='egg' />
                                <div className="stock-name">雞蛋</div>
                                <div className="stock-quantity">擁有: {userStocks.egg} 份</div>
                            </div>
                        </div>
                        <button onClick={handleOrderClick}>下單</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default Trade;
