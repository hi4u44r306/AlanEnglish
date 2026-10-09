import { callEdgeFunction } from "./edgeFunctionClient";
import { correctManagedBirthDate,getManagedBirthDateHistory } from "./membershipService";
jest.mock("./edgeFunctionClient",()=>({callEdgeFunction:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test("history sends only the selected student identity through the authenticated API",async()=>{
    const user={uid:"fixture"};await getManagedBirthDateHistory(user,2);
    expect(callEdgeFunction).toHaveBeenCalledWith("membership-manager",user,{action:"admin_birth_date_history",student_id:2});
});
test("correction preserves nullable expected date and reason without supplying an admin identity",async()=>{
    const user={uid:"fixture"};const payload={student_id:2,expected_date_of_birth:null,date_of_birth:"2016-10-02",reason:"資料修正"};
    await correctManagedBirthDate(user,payload);expect(callEdgeFunction).toHaveBeenCalledWith("membership-manager",user,{action:"admin_correct_birth_date",...payload});
});
