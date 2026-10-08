import React from "react";
import { FiChevronDown } from "react-icons/fi";

export default function StudentSettingsGroup({ title, description, children }) {
    return <details className="student-settings-group">
        <summary>
            <span><strong>{title}</strong><small>{description}</small></span>
            <FiChevronDown aria-hidden="true" />
        </summary>
        <div className="student-settings-group-content">{children}</div>
    </details>;
}
