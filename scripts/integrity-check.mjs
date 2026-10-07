import sql from "mssql";

const pool=await sql.connect({server:process.env.SQL_SERVER,port:Number(process.env.SQL_PORT??1433),database:process.env.SQL_DATABASE,user:process.env.SQL_USER,password:process.env.SQL_PASSWORD,options:{encrypt:process.env.SQL_ENCRYPT==="true",trustServerCertificate:process.env.SQL_TRUST_SERVER_CERTIFICATE==="true"}});
try {
  const result=await pool.request().query(`SELECT
    (SELECT COUNT(*) FROM dbo.Products p LEFT JOIN dbo.Categories c ON c.CategoryId=p.CategoryId WHERE c.CategoryId IS NULL) orphanProducts,
    (SELECT COUNT(*) FROM dbo.ProductVariants v LEFT JOIN dbo.Products p ON p.ProductId=v.ProductId WHERE p.ProductId IS NULL) orphanVariants,
    (SELECT COUNT(*) FROM dbo.Inventory i LEFT JOIN dbo.ProductVariants v ON v.ProductVariantId=i.ProductVariantId WHERE v.ProductVariantId IS NULL) orphanInventory,
    (SELECT COUNT(*) FROM dbo.ProductVariants v LEFT JOIN dbo.Inventory i ON i.ProductVariantId=v.ProductVariantId WHERE i.ProductVariantId IS NULL) variantsWithoutInventory,
    (SELECT COUNT(*) FROM (SELECT SKU FROM dbo.Products GROUP BY SKU HAVING COUNT(*)>1)x) duplicateSku,
    (SELECT COUNT(*) FROM (SELECT VariantSKU FROM dbo.ProductVariants GROUP BY VariantSKU HAVING COUNT(*)>1)x) duplicateVariantSku,
    (SELECT COUNT(*) FROM dbo.Inventory WHERE PhysicalQuantity<0 OR ReservedQuantity<0 OR ReservedQuantity>PhysicalQuantity) invalidInventory,
    (SELECT COUNT(*) FROM dbo.Users u LEFT JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE r.RoleName NOT IN(N'Customer',N'Staff',N'Admin') OR r.RoleName IS NULL) invalidRoles,
    (SELECT COUNT(*) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.IsActive=1 AND r.RoleName=N'Admin') activeAdmins,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'Pending') outboxPending,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'Processing') outboxProcessing,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'Failed') outboxFailed,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'DeadLetter') outboxDeadLetter`);
  console.log(JSON.stringify(result.recordset[0]));
} finally { await pool.close(); }
