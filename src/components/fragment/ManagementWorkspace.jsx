import React, { useId, useRef, useState } from "react";
import "./ManagementWorkspace.scss";

// Panels remain mounted so switching workspaces keeps unfinished form input.
export default function ManagementWorkspace({ tabs, children, label, value, onChange, disabled = false }) {
    const id = useId();
    const refs = useRef([]);
    const [selected, setSelected] = useState(tabs[0].id);
    const active = value ?? selected;
    const panels = React.Children.toArray(children);
    const select = index => {
        if (disabled) return;
        if (onChange) onChange(tabs[index].id);
        else setSelected(tabs[index].id);
    };
    const move = (event, index) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(next);
        refs.current[next]?.focus();
    };
    return <div className="management-workspace">
        <div className="management-workspace__tabs" role="tablist" aria-label={label}>
            {tabs.map((tab, index) => <button key={tab.id} ref={node => { refs.current[index] = node; }}
                id={`${id}-tab-${tab.id}`} role="tab" type="button" disabled={disabled}
                aria-selected={active === tab.id} aria-controls={`${id}-panel-${tab.id}`}
                tabIndex={active === tab.id ? 0 : -1} onClick={() => select(index)} onKeyDown={event => move(event, index)}>
                {tab.label}
            </button>)}
        </div>
        {tabs.map((tab, index) => <div key={tab.id} id={`${id}-panel-${tab.id}`} role="tabpanel"
            aria-labelledby={`${id}-tab-${tab.id}`} hidden={active !== tab.id} tabIndex={0}>
            {panels[index]}
        </div>)}
    </div>;
}
