import React, { useState } from 'react';
import { getDatabase, ref, push } from 'firebase/database';
import './css/LinkAdmin.scss';


export default function LinkAdmin() {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');


    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim() || !url.trim()) {
            setError('請輸入名稱與網址');
            return;
        }


        const db = getDatabase();
        const linksRef = ref(db, 'links');


        push(linksRef, { title: title.trim(), url: url.trim() })
            .then(() => {
                setMessage('新增成功！');
                setTitle('');
                setUrl('');
                setTimeout(() => setMessage(''), 3000);
            })
            .catch(() => setError('新增失敗，請稍後再試'));
    };


    return (
        <div className="link-admin">
            <h1 className="link-admin__title">新增連結後台</h1>


            <form onSubmit={handleSubmit} className="link-admin__form">
                <label className="link-admin__label">
                    <span className="link-admin__label-text">連結名稱</span>
                    <input
                        type="text"
                        placeholder="例：習作本 3"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="link-admin__input"
                    />
                </label>


                <label className="link-admin__label">
                    <span className="link-admin__label-text">網址</span>
                    <input
                        type="text"
                        placeholder="例：https://youtu.be/xxxx"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="link-admin__input"
                    />
                </label>


                <div className="link-admin__actions">
                    <button type="submit" className="link-admin__button">新增</button>
                </div>
            </form>


            {message && <p className="link-admin__message link-admin__message--success">{message}</p>}
            {error && <p className="link-admin__message link-admin__message--error">{error}</p>}
        </div>
    );
}