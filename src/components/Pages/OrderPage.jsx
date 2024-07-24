import React, { useState } from 'react';
import { authentication, rtdb } from './firebase-config';
import { ref, push, update, child } from 'firebase/database';
import './css/OrderPage.scss'; // Import the SCSS file

function OrderPage({ meat, vegetable, egg, unusedMoney, setUnusedMoney, handleOrderClose, userStocks, setUserStocks }) {
    const [meatShares, setMeatShares] = useState(0);
    const [vegetableShares, setVegetableShares] = useState(0);
    const [eggShares, setEggShares] = useState(0);
    const dbRef = ref(rtdb);

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
                        item: `買了 ${shares} 份 ${item}`,
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
            }
        });

        resetShares(item);
    };

    const handleSell = (item, price, shares) => {
        let currentShares;
        switch (item) {
            case 'meat':
                currentShares = parseFloat(userStocks.meat);
                if (shares > currentShares) {
                    alert('沒有足夠的份數來賣出');
                    return;
                }
                break;
            case 'vegetable':
                currentShares = parseFloat(userStocks.vegetable);
                if (shares > currentShares) {
                    alert('沒有足夠的份數來賣出');
                    return;
                }
                break;
            case 'egg':
                currentShares = parseFloat(userStocks.egg);
                if (shares > currentShares) {
                    alert('沒有足夠的份數來賣出');
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
                        item: `賣了 ${shares} 份 ${item}`,
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
            <h2>下單頁面</h2>
            <button className='back-button' onClick={handleOrderClose}>返回</button>
            <div className="input-group">
                <label>肉類</label>
                <input type="number" placeholder='請輸入數字' value={meatShares} onChange={(e) => setMeatShares(e.target.value)} min="0" />
                <button className='buy-button' onClick={() => handleBuy('meat', meat, meatShares)}>買</button>
                <button className='sell-button' onClick={() => handleSell('meat', meat, meatShares)}>賣</button>
                <div className='stock-info'>擁有: {userStocks.meat} 份</div>
            </div>
            <div className="input-group">
                <label>蔬菜</label>
                <input type="number" placeholder='請輸入數字' value={vegetableShares} onChange={(e) => setVegetableShares(e.target.value)} min="0" />
                <button className='buy-button' onClick={() => handleBuy('vegetable', vegetable, vegetableShares)}>買</button>
                <button className='sell-button' onClick={() => handleSell('vegetable', vegetable, vegetableShares)}>賣</button>
                <div className='stock-info'>擁有: {userStocks.vegetable} 份</div>
            </div>
            <div className="input-group">
                <label>雞蛋</label>
                <input type="number" placeholder='請輸入數字' value={eggShares} onChange={(e) => setEggShares(e.target.value)} min="0" />
                <button className='buy-button' onClick={() => handleBuy('egg', egg, eggShares)}>買</button>
                <button className='sell-button' onClick={() => handleSell('egg', egg, eggShares)}>賣</button>
                <div className='stock-info'>擁有: {userStocks.egg} 份</div>
            </div>
            <div className="input-group">
                <label>沒有用到的錢</label>
                <input type="number" placeholder='請輸入數字' value={unusedMoney === '' ? '' : unusedMoney} readOnly />
            </div>
        </div>
    );
}

export default OrderPage;
