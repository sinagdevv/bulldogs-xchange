-- Local Docker demonstration data only. All identities and prices are fictional.
BEGIN;
INSERT INTO dbo.departments(departmentname) VALUES('Local Demo Department');
INSERT INTO dbo.users(schoolid,fullname,email,departmentid,roleid,customertype)
SELECT v.schoolid,v.fullname,v.email,d.departmentid,r.roleid,v.customertype
FROM (VALUES
  ('DEMO-CUSTOMER','Demo Customer','customer@example.test','Customer','Synthetic'),
  ('DEMO-STAFF','Demo Staff','staff@example.test','Staff',NULL),
  ('DEMO-ADMIN','Demo Admin','admin@example.test','Admin',NULL)
) v(schoolid,fullname,email,role,customertype)
JOIN dbo.departments d ON d.departmentname='Local Demo Department'
JOIN dbo.roles r ON r.rolename=v.role;
INSERT INTO dbo.categories(categoryname) VALUES('Synthetic Demo Merchandise');
INSERT INTO dbo.products(categoryid,sku,productname,description,price,imageurl,isfeatured) SELECT c.categoryid,v.sku,v.name,'SYNTHETIC LOCAL DEMO ONLY',v.price,v.image,true FROM dbo.categories c CROSS JOIN (VALUES
 ('BX-SHIRT','Synthetic Bulldogs Shirt',399.00,'/images/products/approved/MER-TSH-001-FRONT.webp'),
 ('BX-CAP','Synthetic Bulldogs Cap',349.00,'/images/products/approved/MER-CAP-001-FRONT.webp'),
 ('BX-TOTE','Synthetic Bulldogs Tote',249.00,'/images/products/approved/MER-TOTE-001-FRONT.webp')
) v(sku,name,price,image) WHERE c.categoryname='Synthetic Demo Merchandise';
INSERT INTO dbo.productvariants(productid,variantname,variantsku) SELECT productid,'Standard',sku||'-STD' FROM dbo.products WHERE sku IN('BX-SHIRT','BX-CAP','BX-TOTE');
INSERT INTO dbo.inventory(productvariantid,physicalquantity,reservedquantity,reorderlevel) SELECT v.productvariantid,CASE p.sku WHEN 'BX-SHIRT' THEN 16 WHEN 'BX-CAP' THEN 4 ELSE 10 END,CASE p.sku WHEN 'BX-SHIRT' THEN 3 WHEN 'BX-CAP' THEN 3 ELSE 1 END,CASE p.sku WHEN 'BX-CAP' THEN 2 ELSE 3 END FROM dbo.productvariants v JOIN dbo.products p USING(productid) WHERE p.sku IN('BX-SHIRT','BX-CAP','BX-TOTE');
INSERT INTO dbo.reservations(reference,customerid,reservationstatusid,expiresat) SELECT 'BX-DEMO-'||v.n,u.userid,s.reservationstatusid,now()+interval '7 days' FROM (VALUES('0001','Pending'),('0002','Confirmed'),('0003','Preparing'),('0004','Ready for Pickup'),('0005','Completed')) v(n,status) JOIN dbo.users u ON u.email='customer@example.test' JOIN dbo.reservationstatuses s ON s.statusname=v.status;
INSERT INTO dbo.reservationitems(reservationid,productvariantid,quantity,unitprice) SELECT r.reservationid,pv.productvariantid,1,p.price FROM dbo.reservations r JOIN dbo.products p ON p.sku=CASE RIGHT(r.reference,1) WHEN '1' THEN 'BX-SHIRT' WHEN '2' THEN 'BX-CAP' WHEN '3' THEN 'BX-TOTE' WHEN '4' THEN 'BX-CAP' ELSE 'BX-SHIRT' END JOIN dbo.productvariants pv ON pv.productid=p.productid WHERE r.reference LIKE 'BX-DEMO-%';
INSERT INTO dbo.systemsettings(settingkey,settingvalue,datatype,description) VALUES('LocalDemoData','true','Boolean','Synthetic local Docker demonstration data only');
COMMIT;
