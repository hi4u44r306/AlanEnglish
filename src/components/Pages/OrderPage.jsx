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
    const [meatShares, setMeatShares] = useState('');
    const [vegetableShares, setVegetableShares] = useState('');
    const [eggShares, setEggShares] = useState('');
    const [meatTotalCost, setMeatTotalCost] = useState(0);
    const [vegetableTotalCost, setVegetableTotalCost] = useState(0);
    const [eggTotalCost, setEggTotalCost] = useState(0);
    // New state for error messages
    const [meatError, setMeatError] = useState('');
    const [vegetableError, setVegetableError] = useState('');
    const [eggError, setEggError] = useState('');
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
                setMeatShares('');
                break;
            case 'vegetable':
                setVegetableShares('');
                break;
            case 'egg':
                setEggShares('');
                break;
            default:
                break;
        }
    };

    const handleSellAll = (item) => {
        let currentShares;
        switch (item) {
            case 'meat':
                currentShares = parseFloat(userStocks.meat);
                break;
            case 'vegetable':
                currentShares = parseFloat(userStocks.vegetable);
                break;
            case 'egg':
                currentShares = parseFloat(userStocks.egg);
                break;
            default:
                return;
        }

        // Check if the user has any stock to sell
        if (currentShares === 0) {
            toast.error(`您沒有任何 ${item} 可以賣出！`);
            return;
        }

        switch (item) {
            case 'meat':
                setMeatShares(currentShares);
                break;
            case 'vegetable':
                setVegetableShares(currentShares);
                break;
            case 'egg':
                setEggShares(currentShares);
                break;
            default:
                break;
        }
    };



    // Check if the input is valid (greater than 0)
    const isMeatSharesValid = parseFloat(meatShares) > 0;
    const isVegetableSharesValid = parseFloat(vegetableShares) > 0;
    const isEggSharesValid = parseFloat(eggShares) > 0;

    // Validation check function
    const validateInput = (value) => {
        if (value === '0') {
            return '數量不能為0';
        }
        return '';
    };

    // Handle input change
    const handleMeatChange = (e) => {
        const value = e.target.value;
        setMeatShares(value);
        setMeatError(validateInput(value));
    };

    const handleVegetableChange = (e) => {
        const value = e.target.value;
        setVegetableShares(value);
        setVegetableError(validateInput(value));
    };

    const handleEggChange = (e) => {
        const value = e.target.value;
        setEggShares(value);
        setEggError(validateInput(value));
    };


    return (
        <div className='order-page'>
            <ToastContainer
                position="top-center"
                className={"notification"}
                autoClose={2200}
                limit={1}
                newestOnTop={true}
            />

            <div className='Ordertitle'>
                <button className='back-button' onClick={handleOrderClose}>返回</button>
                下單頁面
            </div>

            <div className="user-stocks-orderpage">


                <div className='order-title'>您的庫存</div>
                <div className='order-item-container'>

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
                <div className="remaining-money">
                    <div>剩下</div>
                    <div readOnly>{unusedMoney === '' ? '' : unusedMoney}</div>
                    <div>元</div>
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <div className='input-top-title'>肉類</div>
                    <input
                        id='meatShares'
                        className='stock-input'
                        type="number"
                        placeholder='0'
                        value={meatShares}
                        onChange={handleMeatChange}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('meat', meat, meatShares)} disabled={!isMeatSharesValid}>買</button>
                    <button className='sell-button' onClick={() => handleSell('meat', meat, meatShares)} disabled={!isMeatSharesValid}>賣</button>
                    <button className='sell-button' onClick={() => handleSellAll('meat')}>全部賣出</button>
                </div>
                <div className='input-bottom'>
                    {meatShares > 0 && (
                        <div className='total-cost'>總計金額: {meatTotalCost} 元</div>
                    )}
                    {meatError && <div className='error-message'>{meatError}</div>}
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <div className='input-top-title'>蔬菜</div>
                    <input
                        id='vegetableShares'
                        className='stock-input'
                        type="number"
                        placeholder='0'
                        value={vegetableShares}
                        onChange={handleVegetableChange}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('vegetable', vegetable, vegetableShares)} disabled={!isVegetableSharesValid}>買</button>
                    <button className='sell-button' onClick={() => handleSell('vegetable', vegetable, vegetableShares)} disabled={!isVegetableSharesValid}>賣</button>
                    <button className='sell-button' onClick={() => handleSellAll('vegetable')}>全部賣出</button>
                </div>
                <div className='input-bottom'>
                    {vegetableShares > 0 && (
                        <div className='total-cost'>總計金額: {vegetableTotalCost} 元</div>
                    )}
                    {vegetableError && <div className='error-message'>{vegetableError}</div>}
                </div>
            </div>
            <div className="input-group">
                <div className='input-top'>
                    <div className='input-top-title'>雞蛋</div>
                    <input
                        id='eggShares'
                        className='stock-input'
                        type="number"
                        placeholder='0'
                        value={eggShares}
                        onChange={handleEggChange}
                        min="0"
                    />
                    <button className='buy-button' onClick={() => handleBuy('egg', egg, eggShares)} disabled={!isEggSharesValid}>買</button>
                    <button className='sell-button' onClick={() => handleSell('egg', egg, eggShares)} disabled={!isEggSharesValid}>賣</button>
                    <button className='sell-button' onClick={() => handleSellAll('egg')}>全部賣出</button>
                </div>
                <div className='input-bottom'>
                    {eggShares > 0 && (
                        <div className='total-cost'>總計金額: {eggTotalCost} 元</div>
                    )}
                    {eggError && <div className='error-message'>{eggError}</div>}
                </div>
            </div>
        </div>
    );
}

export default OrderPage;
