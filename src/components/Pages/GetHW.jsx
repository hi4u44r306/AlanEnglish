import React, { useState } from 'react'

function GetHW() {
    const [url, setUrl] = useState('');
    const [data, setData] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };
    return (
        <div>
            <h1>Web Scraper</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter URL to scrape"
                />
                <button type="submit">Scrape</button>
            </form>
            {data && (
                <div>
                    <h2>Scraped Data</h2>
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
            )}
        </div>
    )
}

export default GetHW