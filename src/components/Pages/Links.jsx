import React, { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from "firebase/database";
import './css/Links.scss';

function Links() {
    const [links, setLinks] = useState([]);

    useEffect(() => {
        const db = getDatabase();
        const linksRef = ref(db, 'links');

        onValue(linksRef, (snapshot) => {
            const data = snapshot.val() || {};

            const linkArray = Object.keys(data)
                .map(key => data[key])
                .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));

            setLinks(linkArray);
        });
    }, []);

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
                <div className="button-grid">
                    {links.map((link, index) => (
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
            </main>
        </div>
    );
}

export default Links;
