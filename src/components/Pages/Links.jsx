import React from 'react';
import './css/Links.scss';

const links = [
    { title: "習作本 3", url: "https://www.youtube.com/watch?v=zqgkmTWoTYc" },
    { title: "習作本 4", url: "https://youtu.be/Dr2G4S_0Htw?si=h0w_7rkjj0d4wQHd" },
    { title: "F1", url: "https://youtu.be/hl-NknRrMwU?si=KfQ5Uh_2Mr7pO1d5" },
    { title: "F2", url: "https://youtu.be/CIUyObcfZGA?si=ToCwAKtRBe3HQ0sS" },
];
function Links() {
    return (
        <div className="Links">
            <header className="links-header">
                <div className="loginbrand">
                    <span>A</span>
                    <span>L</span>
                    <span>A</span>
                    <span>N</span>
                    <span> </span>
                    <span>E</span>
                    <span>N</span>
                    <span>G</span>
                    <span>L</span>
                    <span>I</span>
                    <span>S</span>
                    <span>H</span>
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

export default Links