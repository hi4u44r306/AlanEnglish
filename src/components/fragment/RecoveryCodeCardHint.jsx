import React from "react";

// 登入卡的示意圖：標出「復原碼」在哪一行。所有文字都是示範用的假資料，不是任何學生的真實內容。
function RecoveryCodeCardHint() {
    return (
        <figure className="platform-card-hint">
            <div className="platform-card-hint__card" aria-hidden="true">
                <div className="platform-card-hint__info">
                    <small>ALAN ENGLISH 英文班登入卡</small>
                    <strong>王小明 · Ming</strong>
                    <dl>
                        <div><dt>帳號</dt><dd>xiaoming</dd></div>
                        <div><dt>臨時密碼</dt><dd>Ae-XXXX-XXXX</dd></div>
                        <div className="is-target"><dt>復原碼</dt><dd><b>123456</b><b>654321</b></dd></div>
                    </dl>
                    <span className="platform-card-hint__pointer">▲ 復原碼在這一行</span>
                </div>
                <div className="platform-card-hint__qr"><span>QR</span><small>掃描開始設定</small></div>
            </div>
            <figcaption>
                復原碼就是登入卡上「臨時密碼」下面那一行<strong>橘色的兩組 6 位數字</strong>。每一組只能用一次，用完再換另一組。<span className="platform-card-hint__sample">（上圖為示意）</span>
            </figcaption>
        </figure>
    );
}

export default RecoveryCodeCardHint;
