# Power Automate contracts

## Security

HTTP trigger URLs and `BX_AUTOMATION_SECRET` are server-only secrets. Bulldogs Xchange flows should validate the `x-bx-api-key` header before processing requests. Logs and responses must never include trigger URLs, secrets, authorization headers, or raw sensitive records.

## Common response envelope

Success: `{ "success": true, "reference": null, "message": "Operation completed.", "data": {} }`

Failure: `{ "success": false, "error": { "code": "SOME_ERROR", "message": "Safe explanation" } }`

## BX-API-Test

Request: `{}`

Response: `{ "success": true, "message": "Bulldogs Xchange API reachable" }`

## BX-API-Catalog

Request:

```json
{
  "action": "categories | products | product | variants | availability",
  "productId": null,
  "search": null,
  "categoryId": null,
  "featured": null,
  "active": true,
  "sort": null
}
```

List response: `{ "success": true, "message": "Catalog data retrieved.", "data": { "items": [] } }`

Single-product response: `{ "success": true, "message": "Product retrieved.", "data": { "item": {} } }`

Items use domain field names. Availability includes `productVariantId`, `physicalQuantity`, `reservedQuantity`, derived `availableQuantity`, `reorderLevel`, and `status` (`Out of Stock`, `Low Stock`, or `Healthy`).

## Future domain flows

- `BX-API-Customer`: profile, reservations, queue, notifications
- `BX-API-Staff`: dashboard, reservations, queue, inventory, movements, alerts
- `BX-API-Admin`: dashboard, users, transactions, audit logs, settings, analytics sources

## Existing write flows

`BX-CreateReservation`, `BX-CancelReservation`, `BX-MarkReady`, `BX-QueueAction`, `BX-AdjustStock`, `BX-Restock`, `BX-ProcessTransaction`, `BX-SaveProduct`, `BX-SetProductActive`, `BX-SaveCategory`, `BX-SetCategoryActive`, `BX-SaveVariant`, `BX-SetVariantActive`, `BX-ChangeUserRole`, `BX-SaveSetting`.

Scheduled flows remain `BX-ExpireReservations`, `BX-LowStockAlert`, and `BX-DailySummary`.
