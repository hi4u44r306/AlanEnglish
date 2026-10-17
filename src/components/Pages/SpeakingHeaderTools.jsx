import React, { useContext } from "react";
import { SpeakingHeaderToolsContext } from "./SpeakingActivityContext";

// 放在關卡標題列裡，讓「先聽本關教材」出現在題數旁邊。
export default function SpeakingHeaderTools() {
    const register = useContext(SpeakingHeaderToolsContext);
    return register ? <div className="speaking-lesson-tools" ref={register} /> : null;
}
