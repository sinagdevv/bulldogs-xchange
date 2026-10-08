-- Idempotent catalog demo data only. Users require explicit approval.
INSERT INTO dbo.categories(categoryname) VALUES('Demo Apparel') ON CONFLICT DO NOTHING;
INSERT INTO dbo.products(categoryid,sku,productname,description,price,isfeatured)
SELECT categoryid,'DEMO-SHIRT','Demo Bulldogs Shirt','Development data only',350,true FROM dbo.categories WHERE categoryname='Demo Apparel' ON CONFLICT DO NOTHING;
INSERT INTO dbo.productvariants(productid,variantname,variantsku)
SELECT productid,'Medium','DEMO-SHIRT-M' FROM dbo.products WHERE sku='DEMO-SHIRT' ON CONFLICT DO NOTHING;
INSERT INTO dbo.inventory(productvariantid,physicalquantity,reservedquantity,reorderlevel)
SELECT productvariantid,20,0,5 FROM dbo.productvariants WHERE variantsku='DEMO-SHIRT-M' ON CONFLICT DO NOTHING;
