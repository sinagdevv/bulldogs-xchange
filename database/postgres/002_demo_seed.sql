BEGIN;
INSERT INTO dbo.departments(departmentname) VALUES('Demo Department') ON CONFLICT DO NOTHING;
INSERT INTO dbo.users(schoolid,fullname,email,departmentid,roleid,customertype) SELECT v.schoolid,v.fullname,v.email,d.departmentid,r.roleid,v.customertype FROM (VALUES('DEMO-CUSTOMER','Demo Customer','customer@example.test','Customer','Demo'),('DEMO-STAFF','Demo Staff','staff@example.test','Staff',NULL),('DEMO-ADMIN','Demo Admin','admin@example.test','Admin',NULL)) v(schoolid,fullname,email,role,customertype) JOIN dbo.departments d ON d.departmentname='Demo Department' JOIN dbo.roles r ON r.rolename=v.role ON CONFLICT DO NOTHING;
INSERT INTO dbo.categories(categoryname) VALUES('Demo Apparel') ON CONFLICT DO NOTHING;
INSERT INTO dbo.products(categoryid,sku,productname,description,price,isfeatured) SELECT categoryid,'DEMO-SHIRT','Demo Bulldogs Shirt','Development data only',350,true FROM dbo.categories WHERE categoryname='Demo Apparel' ON CONFLICT DO NOTHING;
INSERT INTO dbo.productvariants(productid,variantname,variantsku) SELECT productid,'Medium','DEMO-SHIRT-M' FROM dbo.products WHERE sku='DEMO-SHIRT' ON CONFLICT DO NOTHING;
INSERT INTO dbo.inventory(productvariantid,physicalquantity,reservedquantity,reorderlevel) SELECT productvariantid,20,0,5 FROM dbo.productvariants WHERE variantsku='DEMO-SHIRT-M' ON CONFLICT DO NOTHING;
COMMIT;
