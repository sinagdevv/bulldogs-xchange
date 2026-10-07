// Raw SharePoint internal names belong only in this integration boundary.
export const sharePointFields = {
  category: { id: "ID", title: "Title", isActive: "IsActive" },
  product: { id: "ID", title: "Title", categoryId: "CategoryId", sku: "SKU" },
  variant: { id: "ID", productId: "ProductId", name: "Title", variantSku: "VariantSKU" }
} as const;

