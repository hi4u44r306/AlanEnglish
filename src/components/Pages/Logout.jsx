import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoExit } from "react-icons/io5";
import { FONTS } from "./theme";
import { logoutCurrentUser } from "../../auth/authService";
import "./css/Logout.scss";

const Logout = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const logout = async () => {
        if (!window.confirm("確定要登出嗎?")) return;

        setIsLoading(true);

        try {
            await logoutCurrentUser();
            navigate("/", { replace: true });
            window.alert("已成功登出");
        } catch (error) {
            console.error("登出失敗:", error);
            window.alert("登出失敗，請再試一次");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="logoutcontainer">
            <button className="logoutbtn" onClick={logout} disabled={isLoading}>
                <IoExit size={20} />
                <span style={{
                    textAlign: "center",
                    fontSize: "20px",
                    fontFamily: FONTS.semiBold
                }}>
                    {isLoading ? "登出中..." : "登出"}
                </span>
            </button>
        </div>
    );
};

export default Logout;