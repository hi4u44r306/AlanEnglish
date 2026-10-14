import React from "react";
// import ReactDom from 'react-dom';
import App from './app/App';
import './index.scss';
import { registerServiceWorker } from './pwa/registerServiceWorker';
// import { createStore } from "redux";
import reducers from "./reducers/reducer";
import { Provider } from 'react-redux';

// const store = createStore(
//     reducers,
//     window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
// );

// ReactDom.render(
//     <Provider store={store}>
//         <App />
//     </Provider>,
//     document.getElementById('root')
// );
import { createRoot } from 'react-dom/client';

import { configureStore } from '@reduxjs/toolkit';

const store = configureStore({
    reducer: reducers,
    // Other configureStore options (optional)
});
const root = createRoot(document.getElementById('root'));
root.render(
    <Provider store={store}>
        <App />
    </Provider>
);

registerServiceWorker();

// 移除 index.html 的開機畫面（React 已接手顯示自己的讀取畫面）。
requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('boot-splash')?.remove()));
