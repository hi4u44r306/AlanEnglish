import React from "react";
// import ReactDom from 'react-dom';
import App from './app/App';
import './index.scss';
import './theme/theme.scss';
import { ThemeProvider } from './theme/ThemeContext';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import SystemErrorBoundary from './systemReport/SystemErrorBoundary';
import SystemReportHost from './systemReport/SystemReportHost';
import { installGlobalHandlers } from './systemReport/globalHandlers';
import { settleReload } from './systemReport/reloadGuard';
import { restoreResume } from './systemReport/resume';
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
// 問題回報：重新整理後先結算次數、還原捲動位置；再開始監聽載入失敗。
settleReload();
restoreResume();
installGlobalHandlers();

const root = createRoot(document.getElementById('root'));
root.render(
    <>
        <SystemErrorBoundary>
            <Provider store={store}>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </Provider>
        </SystemErrorBoundary>
        <SystemReportHost />
    </>
);

registerServiceWorker();

// index.html 的開機畫面（#boot-splash）：從主畫面圖示開啟時，進入 /userinfo 的讀取畫面（AppLaunchSplash）會一路撐著它，
// 等確認登入、離開 /userinfo 才移除，中間不換畫面，logo 才不會閃。其他路徑在畫面畫好後就移除；最久 8 秒一定移除。
const removeBootSplash = () => document.getElementById('boot-splash')?.remove();
if (window.location.pathname !== '/userinfo') requestAnimationFrame(() => requestAnimationFrame(removeBootSplash));
window.setTimeout(removeBootSplash, 8000);
