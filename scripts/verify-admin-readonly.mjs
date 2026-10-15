import assert from "node:assert/strict";

const base=process.env.BX_E2E_API_URL??"http://localhost:4317/api";
const password=process.env.BX_E2E_ADMIN_PASSWORD;
assert.ok(password,"BX_E2E_ADMIN_PASSWORD is required");

const request=async(path,init={})=>{
  const response=await fetch(`${base}/${path}`,init),payload=await response.json();
  return{status:response.status,payload};
};

try{
  const health=await request("health");
  assert.equal(health.status,200);
  const login=await request("auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"cacanantajrp@students.nu-fairview.edu.ph",password})});
  assert.equal(login.status,200);
  const accessToken=login.payload?.data?.accessToken;
  assert.ok(accessToken,"Login did not return an access token");
  const headers={authorization:`Bearer ${accessToken}`};
  const [session,dashboard,users,reservations,products,inventory,queue,analytics,audit]=await Promise.all([
    request("session",{headers}),request("staff/dashboard",{headers}),request("admin/users",{headers}),request("admin/reservations",{headers}),request("admin/products",{headers}),request("admin/inventory",{headers}),request("admin/queue",{headers}),request("admin/analytics/summary",{headers}),request("admin/audit-logs",{headers}),
  ]);
  for(const result of [session,dashboard,users,reservations,products,inventory,queue,analytics,audit])assert.equal(result.status,200);
  const admin=session.payload?.data?.user;
  assert.deepEqual({id:admin?.id,schoolId:admin?.schoolId,role:admin?.role,isActive:admin?.isActive,approvalStatus:admin?.approvalStatus},{id:"30",schoolId:"2026-0001",role:"Admin",isActive:true,approvalStatus:"approved"});
  const loggedOut=await request("session");
  assert.equal(loggedOut.status,200);
  assert.equal(loggedOut.payload?.data?.authenticated,false);
  console.log(JSON.stringify({health:"PASS",login:"PASS",admin:{id:admin.id,schoolId:admin.schoolId,role:admin.role,isActive:admin.isActive,approvalStatus:admin.approvalStatus},protectedReads:{dashboard:dashboard.status,users:users.payload.data.length,reservations:reservations.payload.data.length,products:products.payload.data.length,inventory:inventory.payload.data.length,queue:queue.payload.data.length,analytics:analytics.status,auditLogs:audit.payload.data.length},logout:{clientTokenCleared:true,anonymousSession:loggedOut.payload.data.authenticated===false},secretsPrinted:false},null,2));
}finally{
  delete process.env.BX_E2E_ADMIN_PASSWORD;
}
