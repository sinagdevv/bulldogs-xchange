export const steps:[string,string][]=[
  ["Register with your NU email","Create an account with your institutional email, Student ID, and a password."],
  ["Await Admin verification","An Admin reviews each registration manually before the account can reserve."],
  ["Browse merchandise","Look through the catalog and check sizes and availability."],
  ["Review and reserve","Confirm the selected variant and quantity before placing your reservation. No online payment is taken."],
  ["Track and collect at campus pickup","Follow your reservation status, then collect at the Xchange counter on campus."],
];

/** The six-stage journey used on the landing page and the How it works page. */
export const journey:[string,string][]=[
  ["Create your account","Register with an eligible NU Fairview institutional email."],
  ["Verify and get approved","Confirm your email, then wait for an Admin to approve the account."],
  ["Explore merchandise","Browse the available campus collection and check sizes and stock."],
  ["Reserve your items","Choose a valid variant and quantity, then confirm. No online payment is taken."],
  ["Follow your updates","Track the reservation status and notifications until it is Ready for Pickup."],
  ["Collect on campus","Bring your school ID and reservation reference to the pickup counter."],
];

/** The journey grouped into three phases (indexes into `journey`), with the outcome of each step. */
export const phases:{id:string;name:string;line:string;icon:"id"|"store"|"pin";steps:number[]}[]=[
  {id:"get-started",name:"Get started",line:"Set up your NU Fairview account.",icon:"id",steps:[0,1]},
  {id:"reserve",name:"Reserve",line:"Choose your merchandise and place a reservation.",icon:"store",steps:[2,3]},
  {id:"collect",name:"Collect",line:"Pick up your items on campus when they are ready.",icon:"pin",steps:[4,5]},
];
export const stepResults=["Account created","Approved to reserve","Your picks chosen","Reservation reference issued","Marked Ready for Pickup","Items in hand"];

export const faq:[string,string][]=[
  ["Why is Admin approval necessary?","Manual identity checks help make sure limited campus stock is reserved by verified NU Fairview students and authorized personnel."],
  ["Who can register?","NU Fairview students and authorized personnel with an eligible institutional email."],
  ["Can I reserve before approval?","No. Reservations unlock once an Admin approves your account."],
  ["How do I know when my item is ready?","Your reservation status changes to Ready for Pickup and a notification appears in your account."],
  ["Is shipping available?","No. Bulldogs Xchange is campus pickup only."],
  ["What happens when a reservation expires?","Each reservation shows an expiry time. Reservations not collected in time are released back to stock."],
];
