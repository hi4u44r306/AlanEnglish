import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
    INSTALL_GUIDE_PATH,
    detectInstallEnvironment,
    externalBrowserUrl,
    getInstallPrompt,
    isRunningAsInstalledApp,
    runInstallPrompt,
    subscribeInstallPrompt
} from "../../utils/installGuide";
import "./css/InstallGuide.scss";

const APP_ICON = "/apple-touch-icon-v3.png";
const STEP_SECONDS = 3;

const DEVICES = { ios: "iPhone／iPad", android: "Android 手機" };

// iPhone／iPad 上 Safari 與 Google Chrome 都能加入主畫面，分享按鈕的位置不同。
const IOS_BROWSERS = {
    safari: { name: "Safari", look: "藍色指南針" },
    chrome: { name: "Google Chrome", look: "紅黃綠藍圓球" }
};

const GUIDES = {
    "ios-safari": {
        label: "iPhone／iPad（Safari）",
        steps: [
            { scene: "ios-share", title: "點「分享」按鈕", hint: "在畫面最下方，方框加一個向上箭頭。沒看到就先點「⋯」。" },
            { scene: "ios-sheet", title: "往下滑，點「加入主畫面」", hint: "選單比較長，要用手指往上推才看得到。" },
            { scene: "ios-confirm", title: "點右上角的「加入」", hint: "名稱不用改，直接點就好。" }
        ]
    },
    "ios-chrome": {
        label: "iPhone／iPad（Google Chrome）",
        steps: [
            { scene: "ioschrome-share", title: "點右上角的「分享」按鈕", hint: "在最上方網址的右邊，方框加一個向上箭頭。" },
            { scene: "ioschrome-sheet", title: "往下滑，點「加入主畫面」", hint: "選單比較長，要用手指往上推才看得到。" },
            { scene: "ioschrome-confirm", title: "點右上角的「加入」", hint: "名稱不用改，直接點就好。" }
        ]
    },
    android: {
        label: "Android 手機",
        steps: [
            { scene: "android-button", title: "點右上角的「⋮」", hint: "三個直排的小點，在網址列的最右邊。" },
            { scene: "android-menu", title: "點「加到主畫面」", hint: "有些手機寫的是「安裝應用程式」，一樣點下去。" },
            { scene: "android-confirm", title: "點「安裝」", hint: "有些手機寫的是「新增」。" }
        ]
    }
};

const DONE_STEP = { scene: "home", title: "完成！", hint: "手機桌面會多一個 Alan English 圖示，以後點它就能打開。" };

const ShareIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12M8 7l4-4 4 4M6 11H5v9h14v-9h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const AddIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const FakePage = () => (
    <div className="ig-page">
        <img src={APP_ICON} alt="" />
        <span className="ig-line ig-line--title" />
        <span className="ig-line" />
        <span className="ig-line ig-line--short" />
        <span className="ig-block" />
    </div>
);

const IosScreen = ({ scene }) => {
    const isChrome = scene.startsWith("ioschrome");
    const shareButton = <b className={scene.endsWith("-share") ? "ig-target" : ""}><ShareIcon /></b>;

    return (
    <>
        <div className="ig-bar ig-bar--address"><span>alanenglish.com.tw</span>{isChrome && shareButton}</div>
        <FakePage />
        <div className="ig-bar ig-bar--ios">
            <i>‹</i>
            <i>›</i>
            {isChrome ? <i>＋</i> : shareButton}
            <i>▢</i>
            <i>⋯</i>
        </div>
        {scene.endsWith("-sheet") && (
            <div className="ig-sheet">
                <span className="ig-sheet__grip" />
                <div className="ig-row">拷貝</div>
                <div className="ig-row">加入書籤</div>
                <div className="ig-row ig-target"><span>加入主畫面</span><AddIcon /></div>
                <div className="ig-row">在網頁中尋找</div>
            </div>
        )}
        {scene.endsWith("-confirm") && (
            <div className="ig-sheet ig-sheet--tall">
                <div className="ig-sheet__head">
                    <span>取消</span>
                    <strong>加入主畫面</strong>
                    <b className="ig-target">加入</b>
                </div>
                <div className="ig-app-row"><img src={APP_ICON} alt="" /><span>Alan English</span></div>
            </div>
        )}
    </>
    );
};

const AndroidScreen = ({ scene }) => (
    <>
        <div className="ig-bar ig-bar--android">
            <span>alanenglish.com.tw</span>
            <b className={scene === "android-button" ? "ig-target" : ""}>⋮</b>
        </div>
        <FakePage />
        {scene === "android-menu" && (
            <div className="ig-menu">
                <div className="ig-row">新分頁</div>
                <div className="ig-row">書籤</div>
                <div className="ig-row ig-target"><span>加到主畫面</span><AddIcon /></div>
                <div className="ig-row">設定</div>
            </div>
        )}
        {scene === "android-confirm" && (
            <div className="ig-dialog">
                <img src={APP_ICON} alt="" />
                <strong>安裝應用程式</strong>
                <span>Alan English</span>
                <div className="ig-dialog__actions"><i>取消</i><b className="ig-target">安裝</b></div>
            </div>
        )}
    </>
);

const HomeScreen = () => (
    <div className="ig-home">
        {Array.from({ length: 7 }, (_, index) => <span key={index} className="ig-home__app" />)}
        <span className="ig-home__app ig-home__app--ae">
            <img src={APP_ICON} alt="" />
            <small>Alan English</small>
        </span>
    </div>
);

const PhoneDemo = ({ scene }) => (
    <div className="ig-phone" aria-hidden="true">
        <div className="ig-phone__screen" key={scene}>
            {scene === "home" ? <HomeScreen /> : scene.startsWith("ios") ? <IosScreen scene={scene} /> : <AndroidScreen scene={scene} />}
        </div>
    </div>
);

const prefersReducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

function InstallGuide() {
    const environment = useMemo(() => detectInstallEnvironment(), []);
    const [installed, setInstalled] = useState(isRunningAsInstalledApp);
    const [device, setDevice] = useState(environment.platform === "android" ? "android" : "ios");
    const [iosBrowser, setIosBrowser] = useState(environment.browser === "ios-chrome" ? "chrome" : "safari");
    const [activeIndex, setActiveIndex] = useState(0);
    const [playing, setPlaying] = useState(() => !prefersReducedMotion());
    const [installPrompt, setInstallPrompt] = useState(getInstallPrompt);
    const [qrImage, setQrImage] = useState("");
    const [copied, setCopied] = useState(false);

    const guide = GUIDES[device === "ios" ? `ios-${iosBrowser}` : device];
    const steps = useMemo(() => [...guide.steps, DONE_STEP], [guide]);
    const pageUrl = `${window.location.origin}${INSTALL_GUIDE_PATH}`;
    const isDesktop = environment.platform === "desktop";
    const inApp = environment.inAppName;

    useEffect(() => subscribeInstallPrompt(setInstallPrompt), []);

    useEffect(() => {
        if (!playing) return undefined;
        const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % steps.length), STEP_SECONDS * 1000);
        return () => window.clearInterval(timer);
    }, [playing, steps.length]);

    useEffect(() => {
        if (!isDesktop) return undefined;
        let cancelled = false;
        QRCode.toString(pageUrl, { type: "svg", margin: 1, width: 220 })
            .then(svg => { if (!cancelled) setQrImage(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [isDesktop, pageUrl]);

    const chooseDevice = next => {
        setDevice(next);
        setActiveIndex(0);
    };
    const chooseIosBrowser = next => {
        setIosBrowser(next);
        setActiveIndex(0);
    };
    const chooseStep = index => {
        setPlaying(false);
        setActiveIndex(index);
    };
    const install = async () => {
        const outcome = await runInstallPrompt();
        if (outcome === "accepted") setInstalled(true);
    };
    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(pageUrl);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <main className="install-guide">
            <Helmet><title>把 Alan English 加到手機桌面｜Alan English</title></Helmet>

            <div className="install-guide__shell">
                <Link className="install-guide__back" to="/">‹ 回首頁</Link>

                <header className="install-guide__header">
                    <img src={APP_ICON} alt="" width="72" height="72" />
                    <h1>把 Alan English 放到手機桌面</h1>
                    <p>只要 3 步，不用下載。以後像 App 一樣，點一下就打開。</p>
                </header>

                {installed && (
                    <p className="install-guide__notice install-guide__notice--ok" role="status">
                        ✅ 已經加好了！以後從手機桌面的 Alan English 圖示打開就可以。
                    </p>
                )}

                {isDesktop && (
                    <section className="install-guide__card install-guide__qr" aria-labelledby="install-qr-heading">
                        <div>
                            <h2 id="install-qr-heading">先用手機打開這一頁</h2>
                            <p>打開手機相機，對準右邊的 QR Code，再照下面的步驟做。</p>
                        </div>
                        {qrImage && <img src={qrImage} alt="用手機掃描開啟加入主畫面教學" width="150" height="150" />}
                    </section>
                )}

                {inApp && (
                    <section className="install-guide__notice install-guide__notice--warn" aria-labelledby="install-inapp-heading">
                        <h2 id="install-inapp-heading">先換一個地方打開</h2>
                        <p>你現在是在 {inApp} 裡面看這一頁，這裡沒辦法加到桌面。</p>
                        {environment.browser === "line" ? (
                            <a className="install-guide__primary" href={externalBrowserUrl(pageUrl)}>
                                用{environment.platform === "ios" ? " Safari " : "瀏覽器"}打開
                            </a>
                        ) : (
                            <>
                                <p>請點右上角的「⋯」，再選「以瀏覽器開啟」。或是複製網址，貼到{environment.platform === "ios" ? " Safari" : " Chrome"}。</p>
                                <button className="install-guide__primary" type="button" onClick={copyUrl}>{copied ? "已複製網址" : "複製網址"}</button>
                            </>
                        )}
                    </section>
                )}

                {installPrompt && !installed && (
                    <section className="install-guide__card install-guide__oneTap">
                        <h2>這支手機可以一鍵完成</h2>
                        <button className="install-guide__primary" type="button" onClick={install}>一鍵加到桌面</button>
                        <p>按下去後，再點「安裝」就好了。</p>
                    </section>
                )}

                <div className="install-guide__tabs" role="group" aria-label="選擇手機種類">
                    {Object.entries(DEVICES).map(([key, label]) => (
                        <button key={key} type="button" aria-pressed={device === key} onClick={() => chooseDevice(key)}>{label}</button>
                    ))}
                </div>

                {device === "ios" && (
                    <div className="install-guide__browsers" role="group" aria-labelledby="install-browser-heading">
                        <p id="install-browser-heading">你平常用哪一個上網？兩個都可以。</p>
                        {Object.entries(IOS_BROWSERS).map(([key, item]) => (
                            <button key={key} type="button" aria-pressed={iosBrowser === key} onClick={() => chooseIosBrowser(key)}>
                                <span className={"install-guide__browserIcon install-guide__browserIcon--" + key} aria-hidden="true" />
                                <span><strong>{item.name}</strong><small>{item.look}</small></span>
                            </button>
                        ))}
                    </div>
                )}

                <section className="install-guide__card install-guide__demo" aria-labelledby="install-steps-heading">
                    <h2 id="install-steps-heading" className="install-guide__sr">{guide.label}的操作步驟</h2>

                    <div className="install-guide__stage">
                        <p className="install-guide__caption" aria-hidden="true">
                            <b>{activeIndex === steps.length - 1 ? "✓" : activeIndex + 1}</b>
                            {steps[activeIndex].title}
                        </p>
                        <PhoneDemo scene={steps[activeIndex].scene} />
                        <button className="install-guide__play" type="button" onClick={() => setPlaying(current => !current)}>
                            {playing ? "⏸ 暫停示範" : "▶ 播放示範"}
                        </button>
                    </div>

                    <ol className="install-guide__steps">
                        {steps.map((step, index) => (
                            <li key={step.scene}>
                                <button
                                    type="button"
                                    className={index === activeIndex ? "is-active" : ""}
                                    aria-current={index === activeIndex ? "step" : undefined}
                                    onClick={() => chooseStep(index)}
                                >
                                    <span className="install-guide__number">{index === steps.length - 1 ? "✓" : index + 1}</span>
                                    <span className="install-guide__copy">
                                        <strong>{step.title}</strong>
                                        <small>{step.hint}</small>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="install-guide__help" aria-label="遇到問題">
                    <details>
                        <summary>找不到「加入主畫面」？</summary>
                        <p>iPhone／iPad 用 Safari 或 Google Chrome 都可以，其中一個找不到就換另一個打開 alanenglish.com.tw。Android 請用 Chrome。從 LINE、Facebook 點進來的連結要先用瀏覽器打開。</p>
                    </details>
                    <details>
                        <summary>我用的是三星手機的瀏覽器</summary>
                        <p>點右下角的「≡」，選「新增頁面至」，再點「主畫面」。</p>
                    </details>
                    <details>
                        <summary>加好之後要重新登入嗎？</summary>
                        <p>第一次從桌面圖示打開時，可能要再登入一次。之後就會保持登入。</p>
                    </details>
                </section>

                <div className="install-guide__footer">
                    <Link className="install-guide__primary" to="/login">加好了，去登入</Link>
                    <Link to="/support">還是不會？聯絡客服</Link>
                </div>
            </div>
        </main>
    );
}

export default InstallGuide;
