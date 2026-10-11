import { callEdgeFunction } from "./edgeFunctionClient";

const callSocial = (firebaseUser, action, payload = {}) => (
    callEdgeFunction("student-social", firebaseUser, { action, ...payload })
);

// The friends system is retired; the function only serves nickname settings now.
export const getNicknameSettings = firebaseUser => callSocial(firebaseUser, "nickname_settings");
export const updateNickname = (firebaseUser, nickname) => callSocial(firebaseUser, "update_nickname", { nickname });
