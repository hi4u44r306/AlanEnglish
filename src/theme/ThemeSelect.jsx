import React from "react";
import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "./ThemeContext";
import "./ThemeSelect.scss";

const OPTIONS = [
    { value: "light", label: "淺色", Icon: FiSun },
    { value: "dark", label: "深色", Icon: FiMoon },
    { value: "system", label: "跟隨系統", Icon: FiMonitor }
];

export default function ThemeSelect({ className = "" }) {
    const { choice, setChoice } = useTheme();
    return (
        <div className={`ae-theme-select ${className}`.trim()} role="radiogroup" aria-label="外觀模式">
            {OPTIONS.map(({ value, label, Icon }) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={choice === value}
                    className={choice === value ? "is-active" : ""}
                    onClick={() => setChoice(value)}
                >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
}
