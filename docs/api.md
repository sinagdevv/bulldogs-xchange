# REST API

Public: `GET /api/health`, `/api/config/public`, `/api/session`, `/api/categories`, `/api/products`, `/api/products/:id`, `/api/products/:id/variants`, `/api/products/:id/availability`. `/api/session` returns deterministic authenticated/unauthenticated state and only safe SQL-backed user fields.

Authenticated: `GET /api/me`, `/api/profile`, `/api/reservations`, `/api/reservations/:id`, `/api/notifications`; `POST /api/reservations`, `/api/reservations/:id/cancel`, `/api/queue/join`, `/api/queue/leave`, `/api/notifications/:id/read`, `/api/notifications/read-all`; `GET /api/queue/me`, `/api/queue/status`. Notification reads and read-state writes are scoped to the authenticated customer.

Staff/admin: dashboard, reservation status operations, queue action, inventory adjustment/restock/movements, transactions, and alerts under `/api/staff/*`.

Admin: read endpoints for dashboard, products, categories, variants, inventory, reservations, queue, transactions, users, audit logs, and settings, plus analytics at `/api/admin/analytics/{summary,sales,reservations,products,inventory,queue}`.

Admin mutations (all require the SQL-backed `Admin` role): `POST /api/admin/products` (`name`, `categoryId`, `sku`, `price`, optional `description`, `imageUrl`, `isFeatured`, `isActive`); `PUT /api/admin/products/:id` (non-empty patch); `PUT /api/admin/products/:id/active` (`isActive`); equivalent category routes with `name` and optional `isActive`; equivalent variant routes with `productId`, `name`, `variantSku`, and optional `isActive`; `PUT /api/admin/users/:id/role` (`role`: `Customer`, `Staff`, or `Admin`); and `PUT /api/admin/settings/:key` (`value`) for `ReservationExpiryDays` or `LowStockDefault`. Creates return `201`; updates return `200`. Possible errors are `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 FORBIDDEN`/`INACTIVE_USER`, `404 NOT_FOUND`, `409 CONFLICT`/`LAST_ADMIN_PROTECTED`, and safe `500 CONFIGURATION_ERROR` responses.

Unsupported routes never return successful placeholder data: unknown routes return `404 NOT_FOUND`; known contracts without an implementation return `501 NOT_IMPLEMENTED`.

Catalog query parameters: `search`, `category`, `featured`, `active`, `sort` (`title`, `price`, `-price`).

SQL retryable writes (`POST /api/reservations`, inventory restock, and transaction processing) require `Idempotency-Key`. Inventory adjustment uses an explicit signed `changeQty` delta; it never changes reserved quantity.

Export TODO: CSV, Excel, PDF, email delivery, and scheduled reports are domain contracts only.
