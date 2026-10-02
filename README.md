# Ultra Freight

Transport & Logistics app for **ERPNext / Frappe v15**. It turns ordinary sales orders and delivery notes into a complete transport dispatch workflow — assign drivers, track deliveries, confirm proof of delivery with an OTP, notify customers by SMS/email, and raise the transport invoice — and exposes all of it through a Next.js **Transport Portal** served from the same Frappe site.

It is built for a **transport company** that hauls goods for its own (goods) customers. Two kinds of transport orders are supported:

- **Linked transport order** — created from a goods Delivery Note / Sales Order marked *Require Direct Delivery*.
- **Standalone (billing-only) transport order** — created directly in the portal, with an optional delivery-note link.

## What it does

- **Transport orders** — creates/updates the transport Sales Order (`custom_is_transport_order`) belonging to the configured transport company, with rate, quantity, address zone and delivery-note link.
- **Automatic dispatch on submit** — a configurable Delivery Note submit/workflow action spins up the transport order and notifies the transport company.
- **Address Zones & transport charges** — zones per transport customer with charges that auto-fill the rate.
- **Driver assignment & tracking** — assign driver + vehicle to a Delivery Note, track in-transit shipments, and view delivery movements.
- **OTP proof of delivery** — an OTP is generated per delivery (configurable expiry), sent to the transport customer and verified in the Driver Portal (managers can also mark a delivery done without an OTP where allowed).
- **Driver Portal** (`/driver`) — mobile-friendly, guest-accessible pages keyed by *driver + unique key*: mark *In Transit*, mark *Arrived*, confirm delivery with OTP.
- **Notifications** — SMS and email on goods ready, on-the-way, driver arrival and delivery confirmation, with full delivery logs.
- **Invoicing** — converts a completed transport order into a transport Sales Invoice (transport item, taxes, accounting dimensions, print format/letterhead from settings).
- **Audit trail** — Delivery Confirmation Log (+ items), Delivery SMS Log and Delivery Email Log.
- **Master data** — Transport Customers (contacts, address, zones), Drivers, Trucks/Vehicles, Zones and Transport Settings.

## End-to-end workflow

1. A **Sales Order** with *Require Direct Delivery* is submitted, or a **Delivery Note** moves through the dispatch workflow → a **transport Sales Order** is created for the transport company (or created manually from the portal).
2. The transport company **assigns a driver and vehicle** to the Delivery Note.
3. The transport order is **approved (submitted)**; an **OTP** is generated and sent to the transport customer and the driver is notified.
4. The **driver** opens the Driver Portal, marks the shipment *In Transit*, then *Arrived*.
5. The **driver confirms delivery** with the OTP (or a manager marks it delivered); a **Delivery Confirmation Log** is written and the Delivery Note's `delivery_status` moves to *Pending Invoicing* → *Completed*.
6. The transport company **raises the transport invoice** from the order.

## Transport Portal (Next.js)

Served by Frappe at **`/transport`** (driver pages at **`/driver`**). The portal is a static Next.js export mounted under the app's public assets.

| Section | What it shows |
| --- | --- |
| Dashboard | Key stats and a monthly invoice trend |
| Transport Orders | Create (linked or standalone/billing-only), edit, approve, reschedule, cancel, regenerate OTP, create invoice |
| Delivery Orders | Dispatch list, assign driver/vehicle, per-item delivery status, update transport customer |
| Tracker | Search shipments by status (default *In Transit*) and view delivery movements |
| OTPs | Active delivery OTPs for driver confirmation, with regeneration |
| Invoices | Transport invoices with status/outstanding and payment recording |
| Confirmation Logs | Proof-of-delivery records with items, GPS/IP and notes |
| SMS Log / Email Log | Outbound notification history |
| Master | Transport Customers, Drivers, Trucks, Zones, Transport Settings (System Manager / Administrator only) |

## Frappe Desk

A workspace **Ultra Dispatch** groups the transport configuration, masters and dispatch documents (Transport Settings, Transport Customer, Driver, Sales Order, Delivery Note, Delivery Confirmation Log, Driver Portal shortcut).

## DocTypes

| DocType | Type | Purpose |
| --- | --- | --- |
| Address Zone | Master | `zone_name`, `zone_city`, `transport_charges`, `more_information` |
| Address Zone Detail | Child | Zone row used inside Transport Customer (`zones`) and transport orders: `zone`, `city`, `more_information`, `transport_charges`, `default` |
| Transport Customer | Master | Final receiver: contact + delivery address, `send_otp`, and its `zones` child table |
| Transport Settings | Single | Charges, OTP, SMS/email, accounting dimensions, print settings and auto-create behaviour |
| Delivery Confirmation Log | Transaction | One record per confirmed delivery: `delivery_note`, `sales_order`, `driver`, `transport_customer`, `status`, `completion_type`, `partial_reason`, `otp`, `confirmation_time`, `ip_address`, `gps_location`, `notes` + `items` |
| Delivery Confirmation Log Item | Child | Delivered items: `item_code`, `item_name`, `qty_ordered`, `qty_delivered`, `uom` |
| Delivery SMS Log | Transaction | SMS audit: `delivery_note`, `event`, `party`, `recipient`, `status`, `message`, `sent_at`, `error` |
| Delivery Email Log | Transaction | Email audit (same shape as the SMS log) |

Transport orders, drivers and trucks reuse ERPNext/Frappe doctypes: **Sales Order**, **Delivery Note** (extended with transport custom fields) and **Driver** (with `unique_key`, `vehicle_number`, `transport_company`).

## Transport Settings

| Group | Fields |
| --- | --- |
| OTP | `otp_expiry_minutes` |
| Company | `ultra_transport_company`, `ultra_transport_email`, `default_transport_item`, `default_sales_taxes_template`, `default_transport_charges` |
| SMS | `enable_sms`, `sms_provider`, `sms_api_key`, `sms_sender_id`, `sms_api_url`, `default_country_code` |
| Email | `enable_email` |
| Accounting dimensions | `branch`, `cost_center` |
| Print | `default_print_format`, `default_letter_head` |
| Dispatch automation | `delivery_note_workflow_action_to_create_order`, `create_transport_order_on_dnote_submission` |

## Transport charge resolution

When a transport order is created or updated, the rate resolves in this order:

1. `Address Zone Detail.transport_charges` for the transport customer + chosen zone
2. `Address Zone.transport_charges`
3. `Transport Settings.default_transport_charges`
4. Legacy fallback: the goods Sales Order's `transport_charge`

## Delivery statuses

`Open → In Transit → Pending Invoicing → Completed`. Legacy values (`Pending`, `Awaiting Transport Order`, `Partially Delivered`) are normalised automatically.

## Server API (whitelisted)

| Module | Highlights |
| --- | --- |
| `api/transport_portal.py` | Portal backend: `get_dashboard_stats`, `get_dispatches`, `get_dispatch_detail`, `track_deliveries`, transport-order CRUD, `submit_transport_order`, `mark_transport_order_delivered`, `reschedule_transport_order`, `cancel_transport_order`, `regenerate_transport_otp`, `create_transport_invoice`, `search_*` lookups, `create_standalone_transport_order`, driver/truck master CRUD |
| `api/transport_dispatch.py` | Business logic: `create_transport_sales_order`, `create_standalone_transport_sales_order`, `initiate_transport_on_sales_order_submit`, OTP setup/regeneration, invoice creation, `resolve_transport_charge`, zone helpers, notification fan-out |
| `api/driver_portal.py` | Guest driver endpoints: `get_active_drivers`, `get_driver_assignments`, `mark_in_transit`, `mark_arrived`, `verify_driver_otp`, `confirm_delivery`, `confirm_delivery_without_otp` |
| `api/notifications.py` | SMS/email notifications and confirmation-log creation |
| `api/permission.py` | `has_app_permission` for the app launcher |

Document overrides keep ERPNext in sync:

- `overrides/sales_order.py` (`UltraFreightSalesOrder`) — validates transport orders, resolves the transport customer and starts dispatch on submit.
- `overrides/delivery_note.py` (`UltraFreightDeliveryNote`) — normalises delivery status and creates/refreshes the transport order from the workflow action.

## Frontend build & deploy

The portal lives in `frontend/` (Next.js 16, React 19, Tailwind CSS v4) and is exported statically into the Frappe app.

```bash
cd apps/ultrafreight
yarn install   # install frontend dependencies
yarn dev       # Next.js dev server (proxies /api to Frappe)
yarn build     # next build + copies the export into ultrafreight/public/frontend
```

`yarn build` writes the exported site to `ultrafreight/public/frontend/_next/` and regenerates `ultrafreight/www/transport_frontend.html` and `ultrafreight/www/driver.html`. Both templates render with `safe_render = False` because the Next.js CSS variables use `__`-prefixed names. Run `bench build --app ultrafreight` (or clear cache) after building.

## Directory layout

```
ultrafreight/
├── ultra_freight/
│   ├── api/          # whitelisted portal, dispatch, driver and notification endpoints
│   ├── doctype/      # Address Zone, Transport Customer, Transport Settings, logs
│   ├── overrides/    # Sales Order & Delivery Note controllers
│   ├── utils/        # settings, OTP, SMS, email, delivery status, customers
│   └── workspace/    # "Ultra Dispatch" desk workspace
├── www/              # transport_frontend.html / driver.html (Next.js shells)
├── frontend/         # Next.js Transport Portal (source + build output)
└── fixtures/         # Custom Fields shipped with the app
```

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch version-15
bench install-app ultrafreight
```

## Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/ultrafreight
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff — import sorter, linter and formatter (config in `pyproject.toml`)
- eslint
- prettier
- pyupgrade

Run every hook against the whole repo — the same checks CI runs:

```bash
pre-commit run --all-files
```

The JS hooks (`prettier`, `eslint`) check hand-written `.js`/`.mjs`/`.scss` files and skip the committed Next.js build output under `frontend/.next`, `frontend/out` and `ultrafreight/public/frontend`.

## CI

GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Jobs | Triggers |
| --- | --- | --- |
| `ci.yml` | **Server** — spins up MariaDB + Redis, installs the app (Frappe `version-15`, Python 3.10, Node 18) and runs `bench --site test_site run-tests --app ultrafreight`. **Linter** — runs `ruff check` (reported as inline PR annotations) and `ruff format --check` using `[tool.ruff]` from `pyproject.toml` | push to `version-15`, pull requests, manual dispatch |
| `linter.yml` | **Frappe Linter** — runs all `pre-commit` hooks, then [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules). **Vulnerable Dependency Check** — [pip-audit](https://pypi.org/project/pip-audit/) | pull requests, manual dispatch |

The ruff version is pinned in `ci.yml` to match the `ruff-pre-commit` revision in `.pre-commit-config.yaml` — bump both together.

## License

MIT
