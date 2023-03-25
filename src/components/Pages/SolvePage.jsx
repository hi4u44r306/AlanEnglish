import React from 'react';
import './css/SolvePage.scss';

function SolvePage() {
    return (
        <div className='solve-page-container'>
            <div className='solve-page'>
                <a style={{ fontWeight: 700 }} href='/' alt='/'>回到登入頁面</a>
                <h1>疑難排解</h1>
                <p><sapn style={{ color: 'red' }}>帳號:</sapn> 英文名字姓@gmail.com</p>
                <p>例如: victorhsu@gmail.com </p>
                <p>（請記得在英文名字後面加上自己的姓）</p>
                <p><sapn style={{ color: 'red' }}>密碼:</sapn> 123456</p>
                <p>聯絡工程師: 0908525057</p>
                <p>連絡時間: 上午9:00 ~ 下午9:00</p>
            </div>
        </div>
    );
}

export default SolvePage;
