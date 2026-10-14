import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
    INSTALL_GUIDE_PATH,
    detectInstallEnvironment,
    externalBrowserUrl,
    getInstallPrompt,
    isHandheldScreen,
    isRunningAsInstalledApp,
    runInstallPrompt,
    subscribeInstallPrompt
} from "../../utils/installGuide";
import "./css/InstallGuide.scss";

const APP_ICON = "/apple-touch-icon-v3.png";
const STEP_SECONDS = 3;

const DEVICES = { ios: "iPhone／iPad", android: "Android 手機" };

// iPhone／iPad 上 Safari 與 Google Chrome 都能加入主畫面，分享按鈕的位置不同。
const CHROME_SECTOR = "M24 12H44.78A24 24 0 0 0 3.22 12L13.61 30A12 12 0 0 1 24 12Z";

const SafariLogo = () => (
    <svg className="install-guide__browserIcon" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
            <linearGradient id="ig-safari-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#19d7ff" />
                <stop offset="1" stopColor="#1e64f0" />
            </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="23" fill="#fff" stroke="#d0d5dd" />
        <circle cx="24" cy="24" r="20.5" fill="url(#ig-safari-sky)" />
        <circle cx="24" cy="24" r="17.5" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="0.7 2.354" />
        <polygon points="35,13 26.1,26.1 21.9,21.9" fill="#ff3b30" />
        <polygon points="13,35 26.1,26.1 21.9,21.9" fill="#fff" />
    </svg>
);

const ChromeLogo = () => (
    <svg className="install-guide__browserIcon" viewBox="0 0 48 48" aria-hidden="true">
        <path d={CHROME_SECTOR} fill="#ea4335" />
        <path d={CHROME_SECTOR} fill="#fbbc04" transform="rotate(120 24 24)" />
        <path d={CHROME_SECTOR} fill="#34a853" transform="rotate(240 24 24)" />
        <circle cx="24" cy="24" r="12" fill="#fff" />
        <circle cx="24" cy="24" r="9.5" fill="#4285f4" />
    </svg>
);

const IOS_BROWSERS = {
    safari: { name: "Safari", Logo: SafariLogo },
    chrome: { name: "Chrome", Logo: ChromeLogo }
};

const GUIDES = {
    "ios-safari": {
        label: "iPhone／iPad（Safari）",
        steps: [
            { scene: "ios-dots", title: "點右下角的「⋯」" },
            { scene: "ios-menu", title: "點「分享」" },
            { scene: "ios-sheet", title: "往下滑，點「加入主畫面」" },
            { scene: "ios-toggle", title: "把「以網頁 App 開啟」打開" },
            { scene: "ios-confirm", title: "點右上角的「加入」" }
        ]
    },
    "ios-chrome": {
        label: "iPhone／iPad（Google Chrome）",
        steps: [
            { scene: "ioschrome-share", title: "點右上角的「分享」" },
            { scene: "ioschrome-viewmore", title: "點「檢視更多」" },
            { scene: "ioschrome-sheet", title: "點「加入主畫面」" },
            { scene: "ioschrome-toggle", title: "把「以網頁 App 開啟」打開" },
            { scene: "ioschrome-confirm", title: "點右上角的「加入」" }
        ]
    },
    android: {
        label: "Android 手機",
        steps: [
            { scene: "android-button", title: "點右上角的「⋮」" },
            { scene: "android-menu", title: "點「加到主畫面」" },
            { scene: "android-confirm", title: "點「安裝」" }
        ]
    }
};

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
        <img src={APP_ICON} alt="" width="40" height="40" decoding="sync" />
        <span className="ig-line ig-line--title" />
        <span className="ig-line" />
        <span className="ig-line ig-line--short" />
        <span className="ig-block" />
    </div>
);

const IosScreen = ({ scene }) => {
    const isChrome = scene.startsWith("ioschrome");
    const shareButton = <b className={scene.endsWith("-share") ? "ig-target" : ""}><ShareIcon /></b>;
    const showForm = scene.endsWith("-toggle") || scene.endsWith("-confirm");

    return (
    <>
        <div className="ig-bar ig-bar--address"><span>alanenglish.com.tw</span>{isChrome && shareButton}</div>
        <FakePage />
        <div className="ig-bar ig-bar--ios">
            <i>‹</i>
            <i>›</i>
            {isChrome && <i>＋</i>}
            <i>▢</i>
            <b className={scene.endsWith("-dots") ? "ig-target" : ""}>⋯</b>
        </div>
        {scene.endsWith("-menu") && (
            <div className="ig-sheet">
                <span className="ig-sheet__grip" />
                <div className="ig-row ig-target"><span>分享</span><ShareIcon /></div>
                <div className="ig-row">新增書籤</div>
                <div className="ig-row">在網頁中尋找</div>
            </div>
        )}
        {scene.endsWith("-viewmore") && (
            <div className="ig-sheet">
                <span className="ig-sheet__grip" />
                <div className="ig-row">拷貝</div>
                <div className="ig-row ig-target"><span>檢視更多</span><b>⋯</b></div>
                <div className="ig-row">列印</div>
            </div>
        )}
        {scene.endsWith("-sheet") && (
            <div className="ig-sheet">
                <span className="ig-sheet__grip" />
                <div className="ig-row">拷貝</div>
                <div className="ig-row">加入書籤</div>
                <div className="ig-row ig-target"><span>加入主畫面</span><AddIcon /></div>
                <div className="ig-row">在網頁中尋找</div>
            </div>
        )}
        {showForm && (
            <div className="ig-sheet ig-sheet--tall">
                <div className="ig-sheet__head">
                    <span>取消</span>
                    <strong>加入主畫面</strong>
                    <b className={scene.endsWith("-confirm") ? "ig-target" : ""}>加入</b>
                </div>
                <div className="ig-app-row"><img src={APP_ICON} alt="" width="40" height="40" decoding="sync" /><span>Alan English</span></div>
                <div className={`ig-toggle-row${scene.endsWith("-toggle") ? " ig-target" : ""}`}>
                    <span>以網頁 App 開啟</span>
                    <i className={`ig-switch${scene.endsWith("-confirm") ? " is-on" : ""}`} />
                </div>
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
                <img src={APP_ICON} alt="" width="40" height="40" decoding="sync" />
                <strong>安裝應用程式</strong>
                <span>Alan English</span>
                <div className="ig-dialog__actions"><i>取消</i><b className="ig-target">安裝</b></div>
            </div>
        )}
    </>
);

const PhoneDemo = ({ scene }) => (
    <div className="ig-phone" aria-hidden="true">
        <div className="ig-phone__screen">
            {scene.startsWith("ios") ? <IosScreen scene={scene} /> : <AndroidScreen scene={scene} />}
        </div>
    </div>
);

const prefersReducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

function InstallGuide() {
    const environment = useMemo(() => detectInstallEnvironment(), []);
    const [installed, setInstalled] = useState(isRunningAsInstalledApp);
    // QR Code 只給真的在用電腦的人；手機即使被判成電腦也不顯示。
    const isDesktop = useMemo(() => environment.platform === "desktop" && !isHandheldScreen(), [environment]);
    const looksLikeAndroid = environment.platform === "android"
        || (environment.platform === "desktop" && !isDesktop && /Linux/.test(window.navigator.userAgent));
    const [device, setDevice] = useState(looksLikeAndroid ? "android" : "ios");
    const [iosBrowser, setIosBrowser] = useState(environment.browser === "ios-chrome" ? "chrome" : "safari");
    const [activeIndex, setActiveIndex] = useState(0);
    const [playing, setPlaying] = useState(() => !prefersReducedMotion());
    const [installPrompt, setInstallPrompt] = useState(getInstallPrompt);
    const [qrImage, setQrImage] = useState("");
    const [copied, setCopied] = useState(false);

    const guide = GUIDES[device === "ios" ? `ios-${iosBrowser}` : device];
    const { steps } = guide;
    const pageUrl = `${window.location.origin}${INSTALL_GUIDE_PATH}`;
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
                    <h1>把 Alan English 加到手機桌面</h1>
                    <p>{steps.length} 步完成，不用下載。</p>
                </header>

                {installed && (
                    <p className="install-guide__notice install-guide__notice--ok" role="status">
                        ✅ 已經加好了！
                    </p>
                )}

                {isDesktop && (
                    <section className="install-guide__card install-guide__qr" aria-labelledby="install-qr-heading">
                        <h2 id="install-qr-heading">請用手機相機掃這個 QR Code</h2>
                        {qrImage && <img src={qrImage} alt="用手機掃描開啟加入主畫面教學" width="150" height="150" />}
                    </section>
                )}

                {inApp && (
                    <section className="install-guide__notice install-guide__notice--warn" aria-labelledby="install-inapp-heading">
                        <h2 id="install-inapp-heading">{inApp} 裡面不能加到桌面</h2>
                        {environment.browser === "line" ? (
                            <a className="install-guide__primary" href={externalBrowserUrl(pageUrl)}>
                                用{environment.platform === "ios" ? " Safari " : "瀏覽器"}打開
                            </a>
                        ) : (
                            <>
                                <p>點右上角「⋯」→「以瀏覽器開啟」。</p>
                                <button className="install-guide__primary" type="button" onClick={copyUrl}>{copied ? "已複製網址" : "複製網址"}</button>
                            </>
                        )}
                    </section>
                )}

                {installPrompt && !installed && (
                    <button className="install-guide__primary install-guide__oneTap" type="button" onClick={install}>一鍵加到桌面</button>
                )}

                <div className="install-guide__tabs" role="group" aria-label="選擇手機種類">
                    {Object.entries(DEVICES).map(([key, label]) => (
                        <button key={key} type="button" aria-pressed={device === key} onClick={() => chooseDevice(key)}>{label}</button>
                    ))}
                </div>

                {device === "ios" && (
                    <div className="install-guide__browsers" role="group" aria-label="選擇瀏覽器">
                        {Object.entries(IOS_BROWSERS).map(([key, item]) => (
                            <button key={key} type="button" aria-pressed={iosBrowser === key} onClick={() => chooseIosBrowser(key)}>
                                <item.Logo />
                                <strong>{item.name}</strong>
                            </button>
                        ))}
                    </div>
                )}

                {device === "ios" && iosBrowser === "chrome" && (
                    <section className="install-guide__notice install-guide__notice--warn" aria-labelledby="install-chrome-heading">
                        <h2 id="install-chrome-heading">建議用 Safari 加入</h2>
                        <p>用 Chrome 加入時，桌面圖示有時會先變成藍底「A」的替代圖。若發生了，請刪掉圖示，等網頁完全載入後再加入一次，或改用 Safari。</p>
                    </section>
                )}

                <section className="install-guide__card install-guide__demo" aria-labelledby="install-steps-heading">
                    <h2 id="install-steps-heading" className="install-guide__sr">{guide.label}的操作步驟</h2>

                    <ol className="install-guide__steps">
                        {steps.map((step, index) => (
                            <li key={step.scene}>
                                <button
                                    type="button"
                                    className={index === activeIndex ? "is-active" : ""}
                                    aria-current={index === activeIndex ? "step" : undefined}
                                    onClick={() => chooseStep(index)}
                                >
                                    <span className="install-guide__number">{index + 1}</span>
                                    <strong>{step.title}</strong>
                                </button>
                            </li>
                        ))}
                    </ol>

                    <PhoneDemo scene={steps[activeIndex].scene} />
                </section>

                <div className="install-guide__footer">
                    <Link className="install-guide__primary" to="/login">加好了，去登入</Link>
                    <Link to="/support">不會操作？聯絡客服</Link>
                </div>
            </div>
        </main>
    );
}

export default InstallGuide;
