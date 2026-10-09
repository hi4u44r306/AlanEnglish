import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./css/NotFound.scss";

const NotFound = () => {
    const navigate = useNavigate();
    const { isAuthenticated, role } = useAuth();
    const home = isAuthenticated ? role === "student" ? "/student/dashboard" : "/userinfo" : "/";
    const canGoBack = (window.history.state?.idx ?? 0) > 0;

    return (
        <main className="notfound-container">
            <section className="notfound-card" aria-labelledby="notfound-heading">
                <span className="notfound-code" aria-hidden="true">404</span>
                <h1 id="notfound-heading">這個頁面找不到了</h1>
                <p>連結可能已更換。你可以回到首頁，重新選擇想學習的內容。</p>
                <div className="notfound-actions">
                    <Link className="notfound-primary" to={home}>回到首頁</Link>
                    {canGoBack && <button type="button" onClick={() => navigate(-1)}>回上一頁</button>}
                    <Link to={isAuthenticated ? "/materials" : "/links"}>尋找教材</Link>
                </div>
            </section>
        </main>
    );
};

export default NotFound;
