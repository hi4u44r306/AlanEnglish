import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "../../auth/AuthContext";
import { correctManagedBirthDate, getManagedBirthDateHistory } from "../../services/membershipService";
import AdminBirthDateDialog from "./AdminBirthDateDialog";
jest.mock("../../auth/AuthContext",()=>({useAuth:jest.fn()}));
jest.mock("../../services/membershipService",()=>({correctManagedBirthDate:jest.fn(),getManagedBirthDateHistory:jest.fn()}));
const user={uid:"fixture-admin"};
const current="2016-03-02";const next="2016-10-02";
const account={id:2,name:"測試學生",date_of_birth:"2010-01-01"};
let close;let saved;
const setup=()=>render(<AdminBirthDateDialog account={account} onClose={close} onSaved={saved}/>);
const ready=async()=>{await waitFor(()=>expect(screen.getByLabelText("新的出生年月日")).toBeEnabled());};
const fill=()=>{fireEvent.change(screen.getByLabelText("新的出生年月日"),{target:{value:next}});fireEvent.change(screen.getByLabelText("更正原因（2～500 字）"),{target:{value:"測試帳號生日更正"}});};
beforeEach(()=>{jest.resetAllMocks();close=jest.fn();saved=jest.fn();useAuth.mockReturnValue({firebaseUser:user,role:"admin"});
    getManagedBirthDateHistory.mockResolvedValue({student:{id:2,date_of_birth:current},history:[]});
    correctManagedBirthDate.mockResolvedValue({student:{id:2,date_of_birth:next},history_entry:{id:3,admin_id:7,previous_date_of_birth:current,new_date_of_birth:next,reason:"測試帳號生日更正",created_at:"2026-10-09T01:00:00Z"}});
});
test("loads the authoritative birthday instead of saving stale account list data",async()=>{
    setup();await ready();expect(screen.getByLabelText("新的出生年月日")).toHaveValue(current);
    expect(getManagedBirthDateHistory).toHaveBeenCalledWith(user,2);expect(screen.getByRole("button",{name:"確認更正並保存"})).toBeDisabled();
});
test("requires a changed date and reason and displays the before/after confirmation",async()=>{
    setup();await ready();fireEvent.change(screen.getByLabelText("新的出生年月日"),{target:{value:next}});
    expect(screen.getByRole("button",{name:"確認更正並保存"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("更正原因（2～500 字）"),{target:{value:"資料修正"}});
    expect(screen.getByText(`確認更正：${current} → ${next}`)).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"確認更正並保存"})).toBeEnabled();
});
test("saves exact expected date, updates the list and displays audit and annual gift notice",async()=>{
    setup();await ready();fill();fireEvent.click(screen.getByRole("button",{name:"確認更正並保存"}));
    await screen.findByRole("status");expect(correctManagedBirthDate).toHaveBeenCalledWith(user,{student_id:2,expected_date_of_birth:current,date_of_birth:next,reason:"測試帳號生日更正"});
    expect(saved).toHaveBeenCalledWith({id:2,date_of_birth:next});expect(screen.getByText(`${current} → ${next}`)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("已領生日禮不會重發");expect(screen.getByRole("button",{name:"確認更正並保存"})).toBeDisabled();
});
test("rapid submission is serialized and Escape cannot dismiss a pending save",async()=>{
    let resolve;correctManagedBirthDate.mockImplementation(()=>new Promise(fn=>{resolve=fn;}));
    setup();await ready();fill();const form=screen.getByLabelText("新的出生年月日").closest("form");
    fireEvent.submit(form);fireEvent.submit(form);fireEvent.keyDown(document,{key:"Escape"});
    expect(correctManagedBirthDate).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
    resolve({student:{id:2,date_of_birth:next},history_entry:{id:3,created_at:"2026-10-09T01:00:00Z"}});await screen.findByRole("status");
});
test("conflict blocks further saving until the authoritative date is reloaded",async()=>{
    correctManagedBirthDate.mockRejectedValueOnce(Object.assign(new Error("生日已修改，請重新讀取"),{status:409,code:"BIRTH_DATE_CHANGED"}));
    setup();await ready();fill();fireEvent.click(screen.getByRole("button",{name:"確認更正並保存"}));
    await screen.findByRole("alert");expect(saved).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"確認更正並保存"})).toBeDisabled();
    getManagedBirthDateHistory.mockResolvedValueOnce({student:{id:2,date_of_birth:"2016-04-02"},history:[]});
    fireEvent.click(screen.getByRole("button",{name:"重新讀取資料"}));await waitFor(()=>expect(screen.getByLabelText("新的出生年月日")).toHaveValue("2016-04-02"));
});
test("failed initial load offers retry and never allows a null assumed birthday save",async()=>{
    getManagedBirthDateHistory.mockRejectedValueOnce(new Error("讀取失敗"));setup();await screen.findByRole("alert");
    expect(screen.getByLabelText("新的出生年月日")).toBeDisabled();expect(correctManagedBirthDate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"重新讀取資料"}));await ready();
});
test("ordinary failure retains the draft and does not display false success",async()=>{
    correctManagedBirthDate.mockRejectedValueOnce(new Error("儲存失敗"));setup();await ready();fill();fireEvent.click(screen.getByRole("button",{name:"確認更正並保存"}));
    await screen.findByRole("alert");expect(screen.getByLabelText("新的出生年月日")).toHaveValue(next);expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("locks background scrolling, contains keyboard focus and restores focus on close",async()=>{
    const prior=document.createElement("button");document.body.appendChild(prior);prior.focus();document.body.style.overflow="auto";
    const view=setup();await ready();expect(document.body.style.overflow).toBe("hidden");
    screen.getByLabelText("新的出生年月日").focus();fireEvent.keyDown(document,{key:"Tab",shiftKey:true});
    expect(screen.getByRole("button",{name:"重新讀取資料"})).toHaveFocus();
    fireEvent.keyDown(document,{key:"Escape"});expect(close).toHaveBeenCalledTimes(1);view.unmount();expect(document.body.style.overflow).toBe("auto");expect(prior).toHaveFocus();prior.remove();document.body.style.overflow="";
});
