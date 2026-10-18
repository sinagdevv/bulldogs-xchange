import {BrowserRouter,Navigate,Route,Routes} from "react-router-dom";
import {Suspense,lazy,type ReactNode} from "react";
import {AppLayout,AuthRedirect,PublicLayout,RequireRole} from "./components";
import {Catalog,InfoPage,Landing,NotFound} from "./pages";
import {CustomerCatalog,CustomerHome,CustomerProductDetails,Notifications,Profile,Queue,ReservationDetails,Reservations} from "./customer";
import {AdminAnalytics,AdminAuditLogs,AdminBarky,AdminCategories,AdminProducts,AdminReports,AdminSettings,AdminVariants,Dashboard,FinancialOperations,Inventory,StaffQueue,StaffReservations,StaffTransactions} from "./staff";
import {SessionProvider} from "./session";
import {ToastProvider} from "./toast";
import {BarkyWidget} from "./barky";
import type {Role} from "./types";
import {AdminUsers} from "./admin-users";
import {PasswordRecovery} from "./recovery";
import {OAuthCallback} from "./auth-callback";

/* Development-only design preview. Production builds do not register this route. */
const Preview=import.meta.env.DEV?lazy(()=>import("./preview")):null;

/* Route paths are unchanged from the previous release; only the screens behind them were redesigned. */
const modules:{path:string;role:Role;element:ReactNode}[]=[
  {path:"staff/reservations",role:"Staff",element:<StaffReservations/>},{path:"staff/queue",role:"Staff",element:<StaffQueue/>},{path:"staff/inventory",role:"Staff",element:<Inventory/>},{path:"staff/transactions",role:"Staff",element:<StaffTransactions/>},
  {path:"staff/financial",role:"Staff",element:<FinancialOperations role="Staff"/>},{path:"admin/financial",role:"Admin",element:<FinancialOperations role="Admin"/>},
  {path:"admin/products",role:"Admin",element:<AdminProducts/>},{path:"admin/categories",role:"Admin",element:<AdminCategories/>},{path:"admin/variants",role:"Admin",element:<AdminVariants/>},{path:"admin/inventory",role:"Admin",element:<Inventory/>},{path:"admin/users",role:"Admin",element:<AdminUsers/>},{path:"admin/analytics",role:"Admin",element:<AdminAnalytics/>},{path:"admin/reports",role:"Admin",element:<AdminReports/>},{path:"admin/settings",role:"Admin",element:<AdminSettings/>},{path:"admin/audit-logs",role:"Admin",element:<AdminAuditLogs/>},{path:"admin/barky",role:"Admin",element:<AdminBarky/>},
];
const guarded=(role:Role,node:ReactNode)=><RequireRole roles={role==="Staff"?["Staff","Admin"]:[role]}>{node}</RequireRole>;

export default function App(){return <SessionProvider><ToastProvider><BrowserRouter><AuthRedirect/><Routes>
  <Route path="auth/recovery" element={<PasswordRecovery/>}/>
  <Route path="auth/invite" element={<PasswordRecovery flow="invite"/>}/>
  <Route path="auth/callback" element={<OAuthCallback/>}/>
  <Route element={<PublicLayout/>}><Route index element={<Landing/>}/><Route path="catalog" element={<Catalog/>}/><Route path="how-it-works" element={<InfoPage/>}/><Route path="campus-pickup" element={<Navigate to={{pathname:"/how-it-works",hash:"pickup"}} replace/>}/></Route>
  <Route element={<AppLayout role="Customer"/>}><Route path="home" element={guarded("Customer",<CustomerHome/>)}/><Route path="shop" element={guarded("Customer",<CustomerCatalog/>)}/><Route path="shop/:id" element={guarded("Customer",<CustomerProductDetails/>)}/><Route path="reservations" element={guarded("Customer",<Reservations/>)}/><Route path="reservations/:id" element={guarded("Customer",<ReservationDetails/>)}/><Route path="queue" element={guarded("Customer",<Queue/>)}/><Route path="notifications" element={guarded("Customer",<Notifications/>)}/><Route path="profile" element={guarded("Customer",<Profile/>)}/></Route>
  <Route element={<AppLayout role="Staff"/>}><Route path="staff" element={guarded("Staff",<Dashboard role="Staff"/>)}/>{modules.filter(x=>x.role==="Staff").map(x=><Route key={x.path} path={x.path} element={guarded(x.role,x.element)}/>)}</Route>
  <Route element={<AppLayout role="Admin"/>}><Route path="admin" element={guarded("Admin",<Dashboard role="Admin"/>)}/>{modules.filter(x=>x.role==="Admin").map(x=><Route key={x.path} path={x.path} element={guarded(x.role,x.element)}/>)}</Route>
  {Preview&&<Route path="design-preview/*" element={<Suspense fallback={null}><Preview/></Suspense>}/>}
  <Route path="*" element={<NotFound/>}/>
</Routes><BarkyWidget/></BrowserRouter></ToastProvider></SessionProvider>}
