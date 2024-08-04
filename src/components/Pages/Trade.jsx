import React, { useEffect, useState } from 'react';
import './css/Trade.scss';
import { authentication, rtdb } from './firebase-config';
import { child, onValue, ref } from 'firebase/database';
import meatimg from '../assets/img/meat.png';
import vegetableimg from '../assets/img/vegetable.png';
import eggimg from '../assets/img/egg.png';
import Marquee from "react-fast-marquee";
import { BsArrowUpCircleFill, BsArrowDownCircleFill } from "react-icons/bs";
import OrderPage from './OrderPage';
import { signOut } from 'firebase/auth';

function Trade() {
    const size = 24;
    const [data, setData] = useState({});
    const [meatprice, setMeatPrice] = useState();
    const [vegetableprice, setVegetablePrice] = useState();
    const [eggprice, setEggPrice] = useState();
    const [newmeatprice, setNewMeatPrice] = useState();
    const [newvegetableprice, setNewVegetablePrice] = useState();
    const [neweggprice, setNewEggPrice] = useState();
    const [news, setNews] = useState();
    const [showOrderPage, setShowOrderPage] = useState(false);
    const [userStocks, setUserStocks] = useState({ meat: 0, vegetable: 0, egg: 0 });
    const dbRef = ref(rtdb);
    const [unusedMoney, setUnusedMoney] = useState();


    function getCurrentDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    useEffect(() => {
        const useruid = localStorage.getItem('ae-useruid');
        const userRef = ref(rtdb, `Trade/TradeTeam/${useruid}`);
        onValue(userRef, snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setData(data);
                setUserStocks({
                    meat: data.meatShares || 0,
                    vegetable: data.vegetableShares || 0,
                    egg: data.eggShares || 0
                });
                setUnusedMoney(data.remainingMoney)
            }
        });
    }, []);



    const total = (newmeatprice || 0) * (userStocks.meat || 0) +
        (newvegetableprice || 0) * (userStocks.vegetable || 0) +
        (neweggprice || 0) * (userStocks.egg || 0) +
        (unusedMoney || 0);


    useEffect(() => {
        const tradeRef = child(dbRef, 'Trade');
        const handleData = onValue(tradeRef, snapshot => {
            if (snapshot.exists()) {
                const tradeData = snapshot.val();
                setMeatPrice(tradeData.Original.meat);
                setVegetablePrice(tradeData.Original.vegetable);
                setEggPrice(tradeData.Original.egg);
                setNewMeatPrice(tradeData.New.meat);
                setNewVegetablePrice(tradeData.New.vegetable);
                setNewEggPrice(tradeData.New.egg);
                setNews(tradeData.News);
            }
        });

        // Cleanup: unsubscribe from the listener
        return () => {
            handleData(); // This is incorrect

        };
    }, [dbRef]);


    const handleOrderClick = () => {
        setShowOrderPage(true);
    };

    const handleOrderClose = () => {
        setShowOrderPage(false);
    };

    const handleClick = (e) => {
        e.preventDefault();
        const correctPassword = '880203'; // 将 'yourPassword' 替换为你实际的密码
        const userInput = prompt('請輸入密碼：');

        if (userInput === correctPassword) {
            window.location.href = '/tradetrack';
        } else {
            alert('密碼錯誤');
        }
    };

    const handleLogout = (e) => {
        if (window.confirm('確定要登出嗎?')) {
            signOut(authentication)
                .then(() => {
                    localStorage.removeItem('ae-useruid');
                    window.location = "/tradelogin";
                    alert('已成功登出');
                }).catch((err) => {
                    console.log(err)
                })
        }
    }

    return (
        <div className='Trade'>
            <div className="trade-container">
                {showOrderPage ? (
                    <OrderPage
                        meat={newmeatprice}
                        vegetable={newvegetableprice}
                        egg={neweggprice}
                        unusedMoney={unusedMoney}
                        setUnusedMoney={setUnusedMoney}
                        handleOrderClose={handleOrderClose}
                        userStocks={userStocks}
                        setUserStocks={setUserStocks}
                    />
                ) : (
                    <>
                        <div className="Tradetitle">
                            理財達人 投資遊戲 (奕彬老師製作)
                            <a onClick={handleClick} style={{ fontSize: 18, fontWeight: 700 }} href="/tradetrack" alt="/tradetrack" >奕彬老師專用</a>
                            <button onClick={handleLogout} className='order-button'>登出</button>
                        </div>

                        <div className='game-rule'>
                            教學理念 : 這個投資遊戲是為了讓小朋友了解投資的基本概念和風險設計的。投資有賺有賠，不要太在意結果，放輕鬆享受遊戲的過程吧！
                        </div>

                        {/* <div className="trade-list">
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
                        </div> */}


                        <div className="trade-list">
                            <div className='userinfo'>
                                <div className='info'>
                                    組別 : 第 {data.name} 組
                                </div>
                                <div className='info'>
                                    金錢 : $ {data.remainingMoney} 元
                                </div>
                                <div className='info'>
                                    預估總價值 : $ {total || "---"} 元
                                </div>
                            </div>
                            <div className='trade-title'>{getCurrentDate()} 的價格</div>
                            <div className='news'>
                                <Marquee
                                    pauseOnHover={false}
                                    direction='right'
                                    speed={30}
                                >
                                    <div>
                                        {news}
                                    </div>
                                </Marquee>
                            </div>

                            <div className='trade-item-container'>
                                <div className="trade-item">
                                    <div className='risk-rate-high'>風險等級: 高 (積極型)</div>
                                    <div className='trade-item-bottom'>
                                        <img className='trade-img' src={meatimg} alt='meat' />
                                        <div className="trade-name">肉類 </div>
                                        <div className="trade-price">
                                            {newmeatprice || "---"} 元
                                            {newmeatprice > meatprice && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                            {newmeatprice < meatprice && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                                        </div>
                                    </div>
                                </div>
                                <div className="trade-item">
                                    <div className='risk-rate-medium'>風險等級: 中 (穩健型)</div>
                                    <div className='trade-item-bottom'>
                                        <img className='trade-img' src={vegetableimg} alt='vegetable' />
                                        <div className="trade-name">蔬菜 </div>
                                        <div className="trade-price">
                                            {newvegetableprice || "---"} 元
                                            {newvegetableprice > vegetableprice && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                            {newvegetableprice < vegetableprice && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                                        </div>
                                    </div>
                                </div>
                                <div className="trade-item">
                                    <div className='risk-rate-low'>風險等級: 低 (保守型)</div>
                                    <div className='trade-item-bottom'>
                                        <img className='trade-img' src={eggimg} alt='egg' />
                                        <div className="trade-name">雞蛋 </div>
                                        <div className="trade-price">
                                            {neweggprice || "---"} 元
                                            {neweggprice > eggprice && <BsArrowUpCircleFill color='red' size={size} className='arrow-up' />}
                                            {neweggprice < eggprice && <BsArrowDownCircleFill color='green' size={size} className='arrow-down' />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="user-stocks">
                            <div className='trade-title'>您的庫存</div>
                            <div className='trade-item-container'>

                                <div className="stock-item">
                                    <img className='stock-img' src={meatimg} alt='meat' />
                                    <div className="stock-name">肉類</div>
                                    <div className="stock-quantity">擁有 : {userStocks.meat} 個單位</div>
                                </div>
                                <div className="stock-item">
                                    <img className='stock-img' src={vegetableimg} alt='vegetable' />
                                    <div className="stock-name">蔬菜</div>
                                    <div className="stock-quantity">擁有 : {userStocks.vegetable} 個單位</div>
                                </div>
                                <div className="stock-item">
                                    <img className='stock-img' src={eggimg} alt='egg' />
                                    <div className="stock-name">雞蛋</div>
                                    <div className="stock-quantity">擁有 : {userStocks.egg} 個單位</div>
                                </div>
                            </div>
                            <button onClick={handleOrderClick} className='order-button'>下單</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Trade;
