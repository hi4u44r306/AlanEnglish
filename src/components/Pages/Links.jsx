import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from "firebase/database";
import './css/Links.scss';

function Links() {
    const [links, setLinks] = useState({
        special: [],
        exercise: [],
        listening: [],
        discovery: [],
        speedphonics: []
    });

    useEffect(() => {
        const db = getDatabase();
        const linksRef = ref(db, 'links');

        onValue(linksRef, (snapshot) => {
            const data = snapshot.val() || {};

            const exercise = [];
            const listening = [];
            const discovery = [];
            const speedphonics = [];
            const special = [];

            Object.keys(data).forEach(key => {
                const item = data[key];
                const title = item.title.toLowerCase();

                if (title.includes("習作本")) {
                    exercise.push(item);
                } else if (title.includes("聽力本")) {
                    listening.push(item);
                } else if (title.includes("discovery")) {
                    discovery.push(item);
                } else if (title.includes("speed phonics")) {
                    speedphonics.push(item);
                } else {
                    // ⭐ 不屬於任何預設分類 → Special
                    special.push(item);
                }
            });

            const sortZH = arr =>
                arr.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));

            setLinks({
                exercise: sortZH(exercise),
                listening: sortZH(listening),
                discovery: sortZH(discovery),
                speedphonics: sortZH(speedphonics),
                special: sortZH(special)
            });
        });
    }, []);

    // ⭐ 若該分類沒有資料，直接不顯示
    const renderSection = (title, items) => {
        if (!items || items.length === 0) return null;

        return (
            <div className="section">
                <h2 className="section-title">{title}</h2>
                <div className="button-grid">
                    {items.map((link, index) => (
                        <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-button"
                        >
                            {link.title}
                        </a>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="Links">
            <header className="links-header">
                <div className="loginbrand">
                    <span>A</span><span>L</span><span>A</span><span>N</span><span> </span>
                    <span>E</span><span>N</span><span>G</span><span>L</span>
                    <span>I</span><span>S</span><span>H</span>
                </div>
            </header>

            <main className="links-main">
                {renderSection("Special", links.special)}
                {renderSection("習作本", links.exercise)}
                {renderSection("聽力本", links.listening)}
                {renderSection("Discovery", links.discovery)}
                {renderSection("Speed Phonics", links.speedphonics)}
            </main>
        </div>
    );
}

export default Links;
