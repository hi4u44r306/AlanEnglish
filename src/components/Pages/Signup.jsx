import React, {
    useCallback,
    useEffect,
    useState
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { authentication } from "./firebase-config";
import {
    createAcademyStudent,
    listAcademyClasses
} from "../../services/academyStudentService";
import {
    isReceivableEmail,
    RECEIVABLE_EMAIL_HELP
} from "../../utils/emailValidation";
import "./css/Signup.scss";

const FALLBACK_CLASSES = [
    {
        id: "E1",
        code: "E1",
        name_zh: "E1 班"
    },
    {
        id: "E3",
        code: "E3",
        name_zh: "E3 班"
    },
    {
        id: "E5",
        code: "E5",
        name_zh: "E5 班"
    },
    {
        id: "E7",
        code: "E7",
        name_zh: "E7 班"
    }
];

const getTaiwanToday = () => {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Taipei",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());
};

const createInitialForm = (
    classCode = "E1",
    enrolledAt = getTaiwanToday(),
    accessEndsAt = ""
) => ({
    chineseName: "",
    englishName: "",
    loginEmail: "",
    classCode,
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    enrolledAt,
    accessEndsAt,
    notes: ""
});

function Signup() {
    const navigate = useNavigate();

    const [firebaseUser, setFirebaseUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    const [classes, setClasses] = useState([]);
    const [classLoading, setClassLoading] = useState(false);
    const [classError, setClassError] = useState("");

    const [form, setForm] = useState(
        createInitialForm()
    );

    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [createdAccount, setCreatedAccount] = useState(null);
    const [copyMessage, setCopyMessage] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            authentication,
            user => {
                setFirebaseUser(user);
                setAuthReady(true);
            }
        );

        return unsubscribe;
    }, []);

    const loadClasses = useCallback(async () => {
        if (!firebaseUser) return;

        setClassLoading(true);
        setClassError("");

        try {
            const result = await listAcademyClasses(
                firebaseUser
            );

            setClasses(result);

            if (
                result.length > 0 &&
                !result.some(
                    item => item.code === form.classCode
                )
            ) {
                setForm(current => ({
                    ...current,
                    classCode: result[0].code
                }));
            }
        } catch (error) {
            setClassError(
                error?.message ||
                "無法讀取班級清單"
            );
        } finally {
            setClassLoading(false);
        }
    }, [firebaseUser, form.classCode]);

    useEffect(() => {
        if (firebaseUser) {
            loadClasses();
        }
    }, [firebaseUser, loadClasses]);

    const classOptions = classes.length > 0
        ? classes
        : FALLBACK_CLASSES;

    const handleChange = event => {
        const {
            name,
            value
        } = event.target;

        setForm(current => ({
            ...current,
            [name]: value
        }));

        setErrorMessage("");
    };

    const validateForm = () => {
        if (!form.chineseName.trim()) {
            return "請輸入學生中文姓名";
        }

        if (!form.loginEmail.trim()) {
            return "請輸入學生登入 Email";
        }

        if (!isReceivableEmail(form.loginEmail)) {
            return RECEIVABLE_EMAIL_HELP;
        }

        if (!form.classCode) {
            return "請選擇學生班級";
        }

        if (!form.enrolledAt) {
            return "請選擇入班日期";
        }

        if (
            form.accessEndsAt &&
            form.accessEndsAt < form.enrolledAt
        ) {
            return "權限截止日不可早於入班日期";
        }

        return "";
    };

    const handleSubmit = async event => {
        event.preventDefault();

        setErrorMessage("");
        setCopyMessage("");

        const validationError = validateForm();

        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        if (!firebaseUser) {
            setErrorMessage(
                "登入狀態已失效，請重新登入"
            );
            return;
        }

        setSubmitting(true);

        try {
            const result = await createAcademyStudent(
                firebaseUser,
                form
            );

            setCreatedAccount(result?.credentials ? result : null);

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        } catch (error) {
            setErrorMessage(
                error?.message ||
                "學生帳號建立失敗"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const copyText = async (text, successMessage) => {
        if (!createdAccount) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage(successMessage);
        } catch (error) {
            setCopyMessage("無法自動複製，請長按內容手動複製");
        }
    };

    const handleCopyAccount = () => {
        copyText(createdAccount.credentials.email, "登入帳號已複製");
    };

    const handleCopyPassword = () => {
        copyText(createdAccount.credentials.temporary_password, "臨時密碼已複製");
    };

    const handleCopyCredentials = () => {
        if (!createdAccount) return;

        const accountText = [
            "Alan English 英文班登入資料",
            `登入 Email：${createdAccount.credentials.email}`,
            `班級：${form.classCode}`,
            `臨時密碼：${createdAccount.credentials.temporary_password}`,
            "首次登入後請立即改成自己的密碼：",
            `${window.location.origin}/login`
        ].join("\n");

        copyText(accountText, "完整登入資料已複製");
    };

    const handleCreateNext = () => {
        setCreatedAccount(null);
        setCopyMessage("");
        setErrorMessage("");

        setForm(
            createInitialForm(
                form.classCode,
                form.enrolledAt,
                form.accessEndsAt
            )
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    if (!authReady) {
        return (
            <main className="academy-account-page">
                <section className="academy-account-state">
                    <div className="academy-account-spinner" />
                    <p>正在確認登入狀態⋯</p>
                </section>
            </main>
        );
    }

    if (!firebaseUser) {
        return (
            <main className="academy-account-page">
                <section className="academy-account-state academy-account-state--error">
                    <h1>登入狀態已失效</h1>
                    <p>
                        請重新登入管理員或老師帳號後再建立學生。
                    </p>

                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                    >
                        前往登入
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="academy-account-page">
            <div className="academy-account-container">
                <header className="academy-account-header">
                    <button
                        type="button"
                        className="academy-account-back"
                        onClick={() => navigate(-1)}
                    >
                        ← 返回
                    </button>

                    <div>
                        <span className="academy-account-eyebrow">
                            Academy Student
                        </span>

                        <h1>快速建立英文班學生</h1>

                        <p>
                            填寫資料後立即建立帳號與一次性臨時密碼，不需要開通碼；學生首次登入後再改成自己的密碼。
                        </p>
                    </div>
                </header>

                {createdAccount ? (
                    <section className="academy-account-success">
                        <div className="academy-account-success-icon">
                            ✓
                        </div>

                        <div className="academy-account-success-heading">
                            <span>Account Created</span>
                            <h2>學生帳號建立成功</h2>
                            <p>
                                請立即複製登入資料交給學生或家長。臨時密碼只顯示這一次，系統不會保存明文。
                            </p>
                        </div>

                        <div className="academy-account-credentials">
                            <div>
                                <span>登入與收信 Email</span>
                                <strong>
                                    {createdAccount.credentials.email}
                                </strong>
                            </div>

                            <div>
                                <span>一次性臨時密碼</span>
                                <strong className="academy-account-password academy-account-invite-link">
                                    {createdAccount.credentials.temporary_password}
                                </strong>
                                <small>
                                    學生首次登入後必須改成自己的密碼
                                </small>
                            </div>
                        </div>

                        {copyMessage && (
                            <p
                                className="academy-account-copy-message"
                                aria-live="polite"
                            >
                                {copyMessage}
                            </p>
                        )}

                        <div className="academy-account-success-actions">
                            <button
                                type="button"
                                className="academy-account-primary-button"
                                onClick={handleCopyAccount}
                            >
                                複製登入帳號
                            </button>

                            <button
                                type="button"
                                className="academy-account-primary-button"
                                onClick={handleCopyPassword}
                            >
                                複製臨時密碼
                            </button>

                            <button
                                type="button"
                                className="academy-account-secondary-button"
                                onClick={handleCopyCredentials}
                            >
                                複製完整登入資料
                            </button>

                            <button
                                type="button"
                                className="academy-account-secondary-button"
                                onClick={handleCreateNext}
                            >
                                建立下一位學生
                            </button>
                        </div>

                        <div className="academy-account-security-note">
                            <strong>安全提醒</strong>
                            <p>
                                臨時密碼不會寫入資料庫；請勿用聊天群組長期保存。若遺失，可由後台寄送密碼重設信。
                            </p>
                        </div>
                    </section>
                ) : (
                    <form
                        className="academy-account-form"
                        onSubmit={handleSubmit}
                    >
                        <section className="academy-account-section">
                            <div className="academy-account-section-heading">
                                <span>01</span>

                                <div>
                                    <h2>學生基本資料</h2>
                                    <p>
                                        中文姓名、登入 Email 與班級為必填。
                                    </p>
                                </div>
                            </div>

                            <div className="academy-account-grid">
                                <label className="academy-account-field">
                                    <span>
                                        中文姓名
                                        <em>*</em>
                                    </span>

                                    <input
                                        type="text"
                                        name="chineseName"
                                        value={form.chineseName}
                                        onChange={handleChange}
                                        maxLength={100}
                                        autoComplete="off"
                                        placeholder="例如：王小明"
                                        required
                                    />
                                </label>

                                <label className="academy-account-field">
                                    <span>英文姓名</span>

                                    <input
                                        type="text"
                                        name="englishName"
                                        value={form.englishName}
                                        onChange={handleChange}
                                        maxLength={100}
                                        autoComplete="off"
                                        placeholder="例如：David"
                                    />
                                </label>

                                <label className="academy-account-field academy-account-field--wide">
                                    <span>
                                        登入與收信 Email
                                        <em>*</em>
                                    </span>

                                    <input
                                        type="email"
                                        name="loginEmail"
                                        value={form.loginEmail}
                                        onChange={handleChange}
                                        maxLength={320}
                                        autoComplete="off"
                                        placeholder="name@gmail.com"
                                        required
                                    />

                                    <small>
                                        {RECEIVABLE_EMAIL_HELP}
                                    </small>
                                </label>

                                <label className="academy-account-field">
                                    <span>
                                        班級
                                        <em>*</em>
                                    </span>

                                    <select
                                        name="classCode"
                                        value={form.classCode}
                                        onChange={handleChange}
                                        disabled={classLoading}
                                        required
                                    >
                                        {classOptions.map(item => (
                                            <option
                                                key={item.id || item.code}
                                                value={item.code}
                                            >
                                                {item.code}
                                                {item.name_zh &&
                                                    item.name_zh !== item.code
                                                    ? `｜${item.name_zh}`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="academy-account-class-status">
                                    {classLoading && (
                                        <p>正在讀取班級⋯</p>
                                    )}

                                    {classError && (
                                        <div>
                                            <p>{classError}</p>

                                            <button
                                                type="button"
                                                onClick={loadClasses}
                                            >
                                                重新讀取
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="academy-account-section">
                            <div className="academy-account-section-heading">
                                <span>02</span>

                                <div>
                                    <h2>家長聯絡資料</h2>
                                    <p>
                                        家長 Email 可供兄弟姊妹共用，不會作為學生登入帳號。
                                    </p>
                                </div>
                            </div>

                            <div className="academy-account-grid">
                                <label className="academy-account-field">
                                    <span>家長姓名</span>

                                    <input
                                        type="text"
                                        name="guardianName"
                                        value={form.guardianName}
                                        onChange={handleChange}
                                        maxLength={100}
                                        autoComplete="off"
                                        placeholder="例如：王先生"
                                    />
                                </label>

                                <label className="academy-account-field">
                                    <span>家長電話</span>

                                    <input
                                        type="tel"
                                        name="guardianPhone"
                                        value={form.guardianPhone}
                                        onChange={handleChange}
                                        maxLength={30}
                                        autoComplete="off"
                                        placeholder="例如：0912-345-678"
                                    />
                                </label>

                                <label className="academy-account-field academy-account-field--wide">
                                    <span>家長 Email</span>

                                    <input
                                        type="email"
                                        name="guardianEmail"
                                        value={form.guardianEmail}
                                        onChange={handleChange}
                                        maxLength={320}
                                        autoComplete="off"
                                        placeholder="parent@example.com"
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="academy-account-section">
                            <div className="academy-account-section-heading">
                                <span>03</span>

                                <div>
                                    <h2>在學與權限資料</h2>
                                    <p>
                                        英文班權限會與學生在學紀錄分開保存。
                                    </p>
                                </div>
                            </div>

                            <div className="academy-account-grid">
                                <label className="academy-account-field">
                                    <span>
                                        入班日期
                                        <em>*</em>
                                    </span>

                                    <input
                                        type="date"
                                        name="enrolledAt"
                                        value={form.enrolledAt}
                                        onChange={handleChange}
                                        required
                                    />
                                </label>

                                <label className="academy-account-field">
                                    <span>權限截止日</span>

                                    <input
                                        type="date"
                                        name="accessEndsAt"
                                        value={form.accessEndsAt}
                                        min={form.enrolledAt}
                                        onChange={handleChange}
                                    />

                                    <small>
                                        留空代表目前不設定固定截止日。
                                    </small>
                                </label>

                                <label className="academy-account-field academy-account-field--wide">
                                    <span>備註</span>

                                    <textarea
                                        name="notes"
                                        value={form.notes}
                                        onChange={handleChange}
                                        maxLength={1000}
                                        rows={4}
                                        placeholder="例如：程度、家長需求或其他注意事項"
                                    />
                                </label>
                            </div>
                        </section>

                        {errorMessage && (
                            <div
                                className="academy-account-error"
                                role="alert"
                            >
                            <strong>無法建立帳號</strong>
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <footer className="academy-account-form-footer">
                            <div>
                                <strong>
                                    系統產生一次性臨時密碼
                                </strong>

                                <p>
                                    帳號建立後即可登入，首次登入會要求修改密碼。
                                </p>
                            </div>

                            <button
                                type="submit"
                                className="academy-account-primary-button"
                                disabled={
                                    submitting ||
                                    classLoading
                                }
                            >
                                {submitting
                                    ? "正在建立帳號⋯"
                                    : "建立學生帳號"}
                            </button>
                        </footer>
                    </form>
                )}
            </div>
        </main>
    );
}

export default Signup;
