import React, { useContext } from "react";
import { SpeakingHeaderToolsContext } from "./SpeakingActivityContext";

// 放在步驟列（1 拼 2 念）右邊，讓「先聽一次」出現在孩子做題的位置。
export default function SpeakingHeaderTools() {
    const register = useContext(SpeakingHeaderToolsContext);
    return register ? <div className="speaking-lesson-tools" ref={register} /> : null;
}
