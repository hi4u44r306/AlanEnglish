import React from 'react'
import './css/News.scss';
import firebase from 'firebase';
import { useState, useEffect } from 'react';


function News() {
    const [data, setData] = useState({});

    useEffect(() => {
        fetch('/api/data')  // Replace with your API endpoint
            .then((response) => response.json())
            .then((data) => setData(data))
            .catch((error) => console.error('Error fetching data:', error));
    }, []);

    firebase.auth().onAuthStateChanged((user) => {
        if (!user) return window.location.href = '/';
    })

    return (
        <div>
            <div>每週英文新聞</div>
            <h1>Python Web Crawler Data:</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}

export default News