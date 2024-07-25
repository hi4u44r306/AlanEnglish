import React, { useState, useEffect } from 'react';
import { authentication, rtdb } from './firebase-config';
import { ref, push, update, child } from 'firebase/database';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './css/OrderPage.scss'; // Import the SCSS file
import meatimg from '../assets/img/meat.png';
import vegetableimg from '../assets/img/vegetable.png';
import eggimg from '../assets/img/egg.png';

function OrderPage({ meat, vegetable, egg, unusedMoney, setUnusedMoney, handleOrderClose, userStocks, setUserStocks }) {
    const [meatShares, setMeatShares] = useState(0);
    const [vegetableShares, setVegetableShares] = useState(0);
    const [eggShares, setEggShares] = useState(0);
    const [meatTotalCost, setMeatTotalCost] = useState(0);
    const [vegetableTotalCost, setVegetableTotalCost] = useState(0);
    const [eggTotalCost, setEggTotalCost] = useState(0);
    const dbRef = ref(rtdb);

    useEffect(() => {
        setMeatTotalCost(meatShares * meat);
    }, [meatShares, meat]);

    useEffect(() => {
        setVegetableTotalCost(vegetableShares * vegetable);
    }, [vegetableShares, vegetable]);

    useEffect(() => {
        setEggTotalCost(eggShares * egg);
    }, [eggShares, egg]);

    function getCurrentDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const hours = String(today.getHours()).padStart(2, '0');
        const minutes = String(today.getMinutes()).padStart(2, '0');
        const seconds = String(today.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    const handleBuy = (item, price, shares) => {
        if (!window.confirm(`您確定要購買 ${shares} 份的 ${item}嗎?`)) {
            return;
        }

        const totalCost = shares * price;
        if (totalCost > unusedMoney) {
            alert('沒有足夠的錢來購買');
            return;
        }

        let newShares;
        switch (item) {
            case 'meat':
                newShares = parseFloat(userStocks.meat) + parseFloat(shares);
                break;
            case 'vegetable':
                newShares = parseFloat(userStocks.vegetable) + parseFloat(shares);
                break;
            case 'egg':
                newShares = parseFloat(userStocks.egg) + parseFloat(shares);
                break;
            default:
                return;
        }

        const newRemainingMoney = unusedMoney - totalCost;
        setUnusedMoney(newRemainingMoney);

        authentication.onAuthStateChanged(user => {
            if (user) {
                // Update user shares and money in Firebase
                update(child(dbRef, `Trade/TradeTeam/${user.uid}`), {
                    [`${item}Shares`]: newShares,
                    remainingMoney: newRemainingMoney
                }).then(() => {
                    // Log transaction
                    const transaction = {
                        date: getCurrentDate(),
                        item: `買了 ${shares} 份的 ${item}`,
                        amount: -totalCost,
                        remaining: newRemainingMoney
                    };
                    push(child(dbRef, `Trade/TradeTeam/${user.uid}/transactions`), transaction);
                });

                // Update local state
                setUserStocks(prevStocks => ({
                    ...prevStocks,
                    [item]: newShares
                }));

                // Show success toast
                toast.success(`成功購買了 ${shares} 份的 ${item}`);
            }
        });

        resetShares(item);
    };

    const handleSell = (item, price, shares) => {
        if (!window.confirm(`您確定要賣出 ${shares} 份的 ${item}嗎?`)) {
            return;
        }

        let currentShares;
        switch (item) {
            case 'meat':
                currentShares = parseFloat(userStocks.meat);
                if (shares > currentShares) {
                    alert('沒有足夠的庫存可以賣出');
                    return;
                }
                break;
            case 'vegetable':
                currentShares = parseFloat(userStocks.vegetable);
                if (shares > currentShares) {
                    alert('沒有足夠的庫存可以賣出');
                    return;
                }
                break;
            case 'egg':
                currentShares = parseFloat(userStocks.egg);
                if (shares > currentShares) {
                    alert('沒有足夠的庫存可以賣出');
                    return;
                }
                break;
            default:
                return;
        }

        const totalRevenue = shares * price;
        const newRemainingMoney = unusedMoney + totalRevenue;
        setUnusedMoney(newRemainingMoney);

        authentication.onAuthStateChanged(user => {
            if (user) {
                // Update user shares and money in Firebase
                update(child(dbRef, `Trade/TradeTeam/${user.uid}`), {
                    [`${item}Shares`]: currentShares - shares,
                    remainingMoney: newRemainingMoney
                }).then(() => {
                    // Log transaction
                    const transaction = {
                        date: getCurrentDate(),
                        item: `賣了 ${shares} 份的 ${item}`,
                        amount: totalRevenue,
                        remaining: newRemainingMoney
                    };
                    push(child(dbRef, `Trade/TradeTeam/${user.uid}/transactions`), transaction);
                });

                // Update local state
                setUserStocks(prevStocks => ({
                    ...prevStocks,
                    [item]: currentShares - shares
                }));

                // Show success toast
                toast.success(`成功賣出了 ${shares} 份的 ${item}`);
            }
        });

        resetShares(item);
    };

    const resetShares = (item) => {
        switch (item) {
            case 'meat':
                setMeatShares(0);
                break;
            case 'vegetable':
                setVegetableShares(0);
                break;
            case 'egg':
                setEggShares(0);
                break;
            default:
                break;
        }
    };

    return (
        <div className='order-page'>
            <ToastContainer />
            <button className='back-button' onClick={handleOrderClose}>返回</button>
            <div className='title'>下單頁面</div>

            <div className="user-stocks-orderpage">
                <div className="remaining-money">
                    <label>剩下</label>
                    <div readOnly>{unusedMoney === '' ? '' : unusedMoney}</div>
                    <label>元</label>
                </div>

                <div className='order-title'>您的庫存</div>
                <div className='trade-item-container'>

                    <div className="stock-item">
                        <img className='order-img' src={meatimg} alt='meat' />
                        <div className="stock-name">肉類</div>
                        <div className="stock-quantity">擁有: {userStocks.meat} 份</div>
                    </div>
                    <div className="stock-item">
                        <img className='order-img' src={vegetableimg} alt='vegetable' />
                        <div className="stock-name">蔬菜</div>
                        <div className="stock-quantity">擁有: {userStocks.vegetable} 份</div>
                    </div>
                    <div className="stock-item">
                        <img className='order-img' src={eggimg} alt='egg' />
                        <div className="stock-name">雞蛋</div>
                        <div className="stock-quantity">擁有: {userStocks.egg} 份</div>
                    </div>
                </div>
                <div className='item-container'>
                    <div className='item-title'>商品價格(每單位價格)</div>
                    <div className='items'>
                        <div className='item'>
                            肉類 {meat} 元
                        </div>
                        <div className='item'>
                            蔬菜 {vegetable} 元
                        </div>
                        <div className='item'>
                            雞蛋 {egg} 元
                        </div>
                    </div>
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <label>肉類</label>
                    <input
                        className='stock-input'
                        type="number"
                        placeholder='請輸入數字'
                        value={meatShares}
                        onChange={(e) => setMeatShares(e.target.value)}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('meat', meat, meatShares)}>買</button>
                    <button className='sell-button' onClick={() => handleSell('meat', meat, meatShares)}>賣</button>
                </div>
                <div className='input-bottom'>
                    {meatShares > 0 && (
                        <div className='total-cost'>總計金額: {meatTotalCost} 元</div>
                    )}
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <label>蔬菜</label>
                    <input
                        className='stock-input'
                        type="number"
                        placeholder='請輸入數字'
                        value={vegetableShares}
                        onChange={(e) => setVegetableShares(e.target.value)}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('vegetable', vegetable, vegetableShares)}>買</button>
                    <button className='sell-button' onClick={() => handleSell('vegetable', vegetable, vegetableShares)}>賣</button>
                </div>
                <div className='input-bottom'>
                    {vegetableShares > 0 && (
                        <div className='total-cost'>總計金額: {vegetableTotalCost} 元</div>
                    )}
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <label>雞蛋</label>
                    <input
                        className='stock-input'
                        type="number"
                        placeholder='請輸入數字'
                        value={eggShares}
                        onChange={(e) => setEggShares(e.target.value)}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('egg', egg, eggShares)}>買</button>
                    <button className='sell-button' onClick={() => handleSell('egg', egg, eggShares)}>賣</button>
                </div>
                <div className='input-bottom'>
                    {eggShares > 0 && (
                        <div className='total-cost'>總計金額: {eggTotalCost} 元</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default OrderPage;
