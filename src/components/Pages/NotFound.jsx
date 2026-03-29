import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/NotFound.scss";

const NotFound = () => {
    const [count, setCount] = useState(5);
    const navigate = useNavigate();

    useEffect(() => {
        if (count === 0) {
            navigate("/");
            return;
        }

        const timer = setTimeout(() => {
            setCount(count - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [count, navigate]);

    return (
        <div className="notfound-container">
            <div className="card">
                <h1 className="title">404</h1>
                <p className="subtitle">頁面不存在</p>

                <div className="countdown">
                    <svg className="progress-ring" width="120" height="120">
                        <circle
                            className="ring-bg"
                            cx="60"
                            cy="60"
                            r="50"
                        />
                        <circle
                            className="ring"
                            cx="60"
                            cy="60"
                            r="50"
                            style={{
                                strokeDashoffset: 314 - (314 * (5 - count)) / 5
                            }}
                        />
                    </svg>
                    <div className="count-text">{count}</div>
                </div>

                <p className="desc">{count} 秒後自動返回首頁</p>

                <button className="btn" onClick={() => navigate("/")}>
                    立即回首頁
                </button>
            </div>
        </div>
    );
};

export default NotFound;