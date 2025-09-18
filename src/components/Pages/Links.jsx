import React from 'react';
import './css/Links.scss';

const links = [
    { title: "習作本 1", url: "https://www.youtube.com/channel/UC1" },
    { title: "習作本 2", url: "https://www.youtube.com/channel/UC2" },
    { title: "習作本 3", url: "https://www.youtube.com/channel/UC3" },
    { title: "習作本 4", url: "https://www.youtube.com/channel/UC4" },
    { title: "習作本 5", url: "https://www.youtube.com/channel/UC5" },
    { title: "習作本 6", url: "https://www.youtube.com/channel/UC6" },
];
function Links() {
    return (
        <div className="Links">
            <header className="links-header">
                <div className="logo">Alan English</div>
            </header>
            <main className="links-main">
                <h1>習作本連結</h1>
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

export default Links