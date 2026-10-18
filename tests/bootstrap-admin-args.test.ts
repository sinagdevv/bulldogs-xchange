import {describe,expect,it} from "vitest";
import {parseBootstrapAdminArgs} from "../src/cli/bootstrap-admin-args.js";

const values=["--project-ref=qyzwruvggwxbmqrurmxh","--user-id=1","--auth-user-id=11111111-1111-4111-8111-111111111111","--email=admin@students.nu-fairview.edu.ph","--current-school-id=2026-1033324","--student-id=2025-1033324","--confirm=CORRECT SCHOOL ID FROM 2026-1033324 TO 2025-1033324 AND PROMOTE admin@students.nu-fairview.edu.ph TO INITIAL BULLDOGS XCHANGE ADMIN"];

describe("bootstrap Admin CLI arguments",()=>{
  it("accepts the operator studentId alias and equals syntax",()=>{expect(parseBootstrapAdminArgs(values)).toMatchObject({projectRef:"qyzwruvggwxbmqrurmxh",targetUserId:1,schoolId:"2025-1033324"});});
  it("accepts documented spaced arguments",()=>{expect(parseBootstrapAdminArgs(["--project-ref","qyzwruvggwxbmqrurmxh","--user-id","1","--auth-user-id","11111111-1111-4111-8111-111111111111","--email","admin@students.nu-fairview.edu.ph","--current-school-id","2026-1033324","--school-id","2025-1033324","--confirm","CORRECT SCHOOL ID FROM 2026-1033324 TO 2025-1033324 AND PROMOTE admin@students.nu-fairview.edu.ph TO INITIAL BULLDOGS XCHANGE ADMIN"])).toMatchObject({schoolId:"2025-1033324"});});
  it("rejects a missing School ID before bootstrap verification",()=>{expect(()=>parseBootstrapAdminArgs(values.filter(value=>!value.startsWith("--student-id=")))).toThrow("Missing required bootstrap argument: --school-id or --student-id");});
  it("rejects a missing current School ID before bootstrap verification",()=>{expect(()=>parseBootstrapAdminArgs(values.filter(value=>!value.startsWith("--current-school-id=")))).toThrow("Missing required bootstrap argument: --current-school-id");});
  it("rejects conflicting School ID arguments",()=>{expect(()=>parseBootstrapAdminArgs([...values,"--school-id=2026-1033324"])).toThrow("Conflicting bootstrap School ID arguments.");});
});
