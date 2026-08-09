import frappe
from frappe import _
from frappe.utils import flt, now_datetime

from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


from ultrafreight.ultra_freight.utils.delivery_status import normalize_delivery_status as _normalize_delivery_status
from ultrafreight.ultra_freight.utils.sms_log import get_delivery_sms_logs
from ultrafreight.ultra_freight.utils.email_log import get_delivery_email_logs


def _require_login():
	if frappe.session.user == "Guest":
		frappe.throw(_("Login required"), frappe.AuthenticationError)


def _transport_company():
	settings = get_transport_settings()
	return settings.get("ultra_transport_company")


def _get_transport_currency() -> str:
	company = _transport_company()
	if company:
		currency = frappe.db.get_value("Company", company, "default_currency")
		if currency:
			return currency
	return frappe.defaults.get_global_default("currency") or "USD"


def _transport_sales_order_filters(extra: dict | None = None) -> dict:
	filters = {"custom_is_transport_order": 1}
	company = _transport_company()
	if company:
		filters["company"] = company
	if extra:
		filters.update(extra)
	return filters


def _get_linked_delivery_notes() -> list[str]:
	return frappe.get_all(
		"Sales Order",
		filters=_transport_sales_order_filters(),
		pluck="custom_delivery_note_to_be_transported",
	) or []


def _dispatch_filters(extra: dict | None = None) -> dict:
	linked_dns = [dn for dn in _get_linked_delivery_notes() if dn]
	filters = {
		"require_direct_delivery": 1,
		"docstatus": 1,
		"name": ("in", linked_dns or ["__none__"]),
	}
	if extra:
		filters.update(extra)
	return filters


def _get_transport_sales_order(delivery_note: str) -> str | None:
	return frappe.db.get_value(
		"Sales Order",
		{
			"custom_is_transport_order": 1,
			"custom_delivery_note_to_be_transported": delivery_note,
			**({"company": _transport_company()} if _transport_company() else {}),
		},
		"name",
	)


def _ensure_transport_delivery_note(delivery_note: str):
	if not frappe.db.exists("Delivery Note", delivery_note):
		frappe.throw(_("Delivery Note not found"))
	if delivery_note not in _get_linked_delivery_notes():
		frappe.throw(_("This delivery note is not linked to your transport company"))


def _ensure_transport_sales_order(sales_order: str):
	if not frappe.db.exists("Sales Order", sales_order):
		frappe.throw(_("Sales Order not found"))
	values = frappe.db.get_value(
		"Sales Order",
		sales_order,
		["custom_is_transport_order", "company", "docstatus"],
		as_dict=True,
	)
	if not values or not values.custom_is_transport_order:
		frappe.throw(_("This is not a transport sales order"))
	company = _transport_company()
	if company and values.company != company:
		frappe.throw(_("This transport order belongs to another company"))


def _ensure_driver_access(driver_name: str):
	if not frappe.db.exists("Driver", driver_name):
		frappe.throw(_("Driver not found"))
	company = _transport_company()
	if company and frappe.db.get_value("Driver", driver_name, "transport_company") != company:
		frappe.throw(_("This driver belongs to another transport company"))


@frappe.whitelist()
def get_dashboard_stats():
	_require_login()
	dispatch_filters = _dispatch_filters()

	dn_invoice_rows = frappe.get_all(
		"Delivery Note",
		filters={**dispatch_filters, "transport_sales_invoice": ("is", "set")},
		fields=["name", "transport_sales_invoice", "transport_customer_name", "transport_customer"],
	)
	invoice_names = list({row.transport_sales_invoice for row in dn_invoice_rows if row.transport_sales_invoice})

	transport_invoices = 0
	total_invoiced_amount = 0
	draft_order_amount = 0
	submitted_order_amount = 0
	currency = None
	invoice_records = []
	if invoice_names:
		invoice_records = frappe.get_all(
			"Sales Invoice",
			filters={"name": ("in", invoice_names), "docstatus": 1},
			fields=["name", "grand_total", "posting_date", "currency"],
		)
		transport_invoices = len(invoice_records)
		total_invoiced_amount = sum(flt(row.grand_total) for row in invoice_records)
		if invoice_records:
			currency = invoice_records[0].currency

	draft_orders = frappe.get_all(
		"Sales Order",
		filters={**_transport_sales_order_filters(), "docstatus": 0},
		fields=["grand_total", "currency"],
	)
	submitted_orders = frappe.get_all(
		"Sales Order",
		filters={**_transport_sales_order_filters(), "docstatus": 1},
		fields=["grand_total", "currency"],
	)
	draft_order_amount = sum(flt(row.grand_total) for row in draft_orders)
	submitted_order_amount = sum(flt(row.grand_total) for row in submitted_orders)
	if not currency and draft_orders:
		currency = draft_orders[0].currency
	elif not currency and submitted_orders:
		currency = submitted_orders[0].currency
	if not currency:
		currency = _get_transport_currency()

	invoice_amount_map = {row.name: flt(row.grand_total) for row in invoice_records}
	customer_stats = {}
	for dn in dn_invoice_rows:
		customer = dn.transport_customer_name or dn.transport_customer or _("Unknown")
		amount = invoice_amount_map.get(dn.transport_sales_invoice, 0)
		if customer not in customer_stats:
			customer_stats[customer] = {"customer": customer, "invoice_count": 0, "total_amount": 0}
		customer_stats[customer]["invoice_count"] += 1
		customer_stats[customer]["total_amount"] += amount

	top_transport_customers = sorted(
		customer_stats.values(), key=lambda row: row["total_amount"], reverse=True
	)[:8]

	monthly_invoices = _get_monthly_invoice_trend(invoice_records)

	return {
		"open_dispatches": frappe.db.count(
			"Delivery Note", {**dispatch_filters, "delivery_status": "Open"}
		),
		"needs_action": len(
			frappe.get_all(
				"Delivery Note",
				filters={**dispatch_filters, "delivery_status": "Open"},
				pluck="name",
			)
		)
		+ frappe.db.count("Sales Order", {**_transport_sales_order_filters(), "docstatus": 0}),
		"pending_dispatches": frappe.db.count(
			"Delivery Note",
			{**dispatch_filters, "delivery_status": ("in", ["Open", "", None])},
		),
		"in_transit": frappe.db.count(
			"Delivery Note", {**dispatch_filters, "delivery_status": "In Transit"}
		),
		"pending_invoicing": frappe.db.count(
			"Delivery Note", {**dispatch_filters, "delivery_status": "Pending Invoicing"}
		),
		"completed": frappe.db.count(
			"Delivery Note",
			{**dispatch_filters, "delivery_status": "Completed"},
		),
		"active_otps": frappe.db.count(
			"Delivery Note",
			{
				**dispatch_filters,
				"otp": ("is", "set"),
				"otp_expires_at": (">", now_datetime()),
				"delivery_status": "In Transit",
			},
		),
		"transport_orders": frappe.db.count(
			"Sales Order", {**_transport_sales_order_filters(), "docstatus": 0}
		),
		"transport_invoices": transport_invoices,
		"drivers": frappe.db.count(
			"Driver",
			{"status": "Active", **({"transport_company": _transport_company()} if _transport_company() else {})},
		),
		"currency": currency,
		"total_invoiced_amount": total_invoiced_amount,
		"draft_order_amount": draft_order_amount,
		"submitted_order_amount": submitted_order_amount,
		"avg_invoice_amount": (total_invoiced_amount / transport_invoices) if transport_invoices else 0,
		"top_transport_customers": top_transport_customers,
		"monthly_invoice_trend": monthly_invoices,
	}


def _get_monthly_invoice_trend(invoice_records: list, months: int = 6) -> list[dict]:
	from frappe.utils import getdate, add_months

	if not invoice_records:
		return []

	today = getdate()
	buckets = {}
	for i in range(months - 1, -1, -1):
		month_start = add_months(today.replace(day=1), -i)
		key = month_start.strftime("%Y-%m")
		buckets[key] = {"month": key, "label": month_start.strftime("%b"), "amount": 0, "count": 0}

	for row in invoice_records:
		if not row.posting_date:
			continue
		key = getdate(row.posting_date).strftime("%Y-%m")
		if key in buckets:
			buckets[key]["amount"] += flt(row.grand_total)
			buckets[key]["count"] += 1

	return list(buckets.values())


@frappe.whitelist()
def get_dispatches(status: str | None = None, filter: str | None = None, search: str | None = None):
	_require_login()
	filters = _dispatch_filters()
	if status:
		filters["delivery_status"] = status

	if filter == "open":
		filters["delivery_status"] = "Open"
	elif filter == "in_transit":
		filters["delivery_status"] = "In Transit"
	elif filter == "pending_invoicing":
		filters["delivery_status"] = "Pending Invoicing"
	elif filter == "completed":
		filters["delivery_status"] = "Completed"
	elif filter == "no_driver":
		filters["driver"] = ("in", ["", None])
	elif filter == "needs_action":
		pass

	records = frappe.get_all(
		"Delivery Note",
		filters=filters,
		fields=[
			"name",
			"customer",
			"customer_name",
			"posting_date",
			"delivery_status",
			"sms_status",
			"email_status",
			"driver",
			"vehicle_no",
			"transport_customer_name",
			"transport_phone",
			"transport_email",
			"transport_address",
			"otp",
			"otp_expires_at",
			"transport_sales_order",
			"transport_sales_invoice",
			"confirmation_log",
		],
		order_by="modified desc",
		limit=200,
	)

	if filter == "needs_action":
		filtered = []
		for row in records:
			so_docstatus = frappe.db.get_value("Sales Order", row.transport_sales_order, "docstatus")
			if row.delivery_status == "Open" or so_docstatus == 0:
				filtered.append(row)
		records = filtered

	if search:
		term = search.strip().lower()
		records = [
			row
			for row in records
			if term in (row.name or "").lower()
			or term in (row.customer_name or "").lower()
			or term in (row.transport_customer_name or "").lower()
			or term in (row.driver or "").lower()
		]

	for row in records:
		row["delivery_status"] = _normalize_delivery_status(row.delivery_status)
		row["items"] = frappe.get_all(
			"Delivery Note Item",
			filters={"parent": row.name},
			fields=["item_code", "item_name", "qty", "uom"],
		)
		row["item_status"] = _get_item_delivery_status(row.name, row.delivery_status)
		so_docstatus = frappe.db.get_value("Sales Order", row.transport_sales_order, "docstatus")
		row["transport_order_submitted"] = so_docstatus == 1
		row["needs_action"] = row.delivery_status == "Open" or so_docstatus == 0
	return records


def _confirmation_log_items_available() -> bool:
	return bool(frappe.db.exists("DocType", "Delivery Confirmation Log Item"))


def _get_confirmation_log_items(log_name: str) -> list[dict]:
	if not _confirmation_log_items_available():
		return []
	return frappe.get_all(
		"Delivery Confirmation Log Item",
		filters={"parent": log_name},
		fields=["item_code", "item_name", "qty_ordered", "qty_delivered", "uom"],
	)


def _get_item_delivery_status(delivery_note_name: str, delivery_status: str | None) -> list[dict]:
	delivery_status = _normalize_delivery_status(delivery_status)
	dn_items = frappe.get_all(
		"Delivery Note Item",
		filters={"parent": delivery_note_name},
		fields=["item_code", "item_name", "qty", "uom"],
	)
	delivered_map = {}
	if delivery_status in ("Completed", "Pending Invoicing"):
		log_name = frappe.db.get_value("Delivery Note", delivery_note_name, "confirmation_log")
		if log_name and _confirmation_log_items_available():
			for row in _get_confirmation_log_items(log_name):
				delivered_map[row["item_code"]] = row

	result = []
	for item in dn_items:
		delivered = delivered_map.get(item.item_code)
		qty_delivered = flt(delivered.get("qty_delivered")) if delivered else None
		qty_ordered = flt(item.qty)
		if delivery_status in ("Completed", "Pending Invoicing"):
			if delivered and qty_delivered < qty_ordered:
				item_status = "Partially Delivered"
			else:
				item_status = "Delivered"
		elif delivery_status == "In Transit":
			item_status = "In Transit"
		elif delivery_status == "Open":
			item_status = "Open"
		else:
			item_status = delivery_status
		result.append(
			{
				"item_code": item.item_code,
				"item_name": item.item_name,
				"qty_ordered": qty_ordered,
				"qty_delivered": qty_delivered,
				"uom": item.uom,
				"status": item_status,
			}
		)
	return result


@frappe.whitelist()
def get_dispatch_detail(delivery_note: str):
	_require_login()
	_ensure_transport_delivery_note(delivery_note)
	doc = frappe.get_doc("Delivery Note", delivery_note)
	logs = frappe.get_all(
		"Delivery Confirmation Log",
		filters={"delivery_note": delivery_note},
		fields=[
			"name",
			"status",
			"completion_type",
			"partial_reason",
			"confirmation_time",
			"driver",
			"otp",
		],
		order_by="confirmation_time asc",
	)
	confirmation_logs = []
	for log in logs:
		row = dict(log)
		row["items"] = _get_confirmation_log_items(row["name"])
		confirmation_logs.append(row)

	return {
		"name": doc.name,
		"delivery_status": _normalize_delivery_status(doc.delivery_status),
		"customer_name": doc.customer_name,
		"transport_customer_name": doc.transport_customer_name,
		"transport_address": doc.transport_address,
		"driver": doc.driver,
		"vehicle_no": doc.get("vehicle_no"),
		"transport_sales_order": doc.transport_sales_order,
		"transport_sales_invoice": doc.transport_sales_invoice,
		"item_status": _get_item_delivery_status(doc.name, doc.delivery_status),
		"confirmation_logs": confirmation_logs,
		"sms_logs": get_delivery_sms_logs(doc.name),
		"sms_status": doc.get("sms_status") or "Not Sent",
		"email_logs": get_delivery_email_logs(doc.name),
		"email_status": doc.get("email_status") or "Not Sent",
		"movements": _get_delivery_movements(delivery_note),
	}


def _get_delivery_movements(delivery_note: str) -> list[dict]:
	logs = frappe.get_all(
		"Delivery Confirmation Log",
		filters={"delivery_note": delivery_note},
		fields=["status", "confirmation_time", "completion_type", "partial_reason", "driver"],
		order_by="confirmation_time asc",
	)
	if logs:
		return [
			{
				"status": row.status,
				"confirmation_time": row.confirmation_time,
				"completion_type": row.completion_type,
				"partial_reason": row.partial_reason,
				"driver": row.driver,
			}
			for row in logs
		]

	current_status = _normalize_delivery_status(
		frappe.db.get_value("Delivery Note", delivery_note, "delivery_status")
	)
	return [{"status": current_status, "confirmation_time": None, "driver": None}]


@frappe.whitelist()
def track_deliveries(query: str | None = None, status: str | None = "In Transit"):
	_require_login()
	filters = _dispatch_filters()
	if status and status not in ("all", ""):
		if status == "completed":
			filters["delivery_status"] = "Completed"
		else:
			filters["delivery_status"] = status

	records = frappe.get_all(
		"Delivery Note",
		filters=filters,
		fields=[
			"name",
			"delivery_status",
			"transport_customer_name",
			"customer_name",
			"driver",
			"transport_phone",
			"transport_address",
			"otp",
			"otp_expires_at",
			"posting_date",
			"transport_sales_order",
		],
		order_by="modified desc",
		limit=100,
	)

	if query and query.strip():
		term = query.strip().lower()
		records = [
			row
			for row in records
			if term in (row.name or "").lower()
			or term == (row.otp or "").lower()
			or term in (row.transport_customer_name or "").lower()
			or term in (row.customer_name or "").lower()
		]

	for row in records:
		row["delivery_status"] = _normalize_delivery_status(row.delivery_status)
		row["movements"] = _get_delivery_movements(row.name)

	return records


@frappe.whitelist()
def get_transport_orders(docstatus: str | None = None):
	_require_login()
	filters = _transport_sales_order_filters()
	if docstatus not in (None, ""):
		filters["docstatus"] = int(docstatus)

	fields = [
		"name",
		"customer",
		"customer_name",
		"transaction_date",
		"grand_total",
		"docstatus",
		"custom_delivery_note_to_be_transported",
		"status",
		"currency",
		"custom_main_company_invoice",
		"custom_main_company_invoice_date",
		"custom_last_customer_invoice",
		"custom_last_customer_invoice_date",
		"custom_last_customer_delivery_note",
		"custom_last_customer_delivery_note_date",
		"custom_final_customer_feedback_document",
		"custom_note",
		"custom_reschedule_transport_order",
		"custom_reason_for_reschedule",
	]
	if frappe.get_meta("Sales Order").has_field("custom_address_zone"):
		fields.append("custom_address_zone")

	orders = frappe.get_all(
		"Sales Order",
		filters=filters,
		fields=fields,
		order_by="modified desc",
		limit=200,
	)
	from ultrafreight.ultra_freight.api.transport_dispatch import (
		get_main_company_invoice_for_delivery_note,
		get_transport_customer_send_otp,
		get_zones_for_transport_customer,
		sync_main_company_invoice_to_transport_order,
	)

	for order in orders:
		order["items"] = frappe.get_all(
			"Sales Order Item",
			filters={"parent": order.name},
			fields=["name", "item_code", "item_name", "qty", "rate", "amount", "uom"],
		)
		dn = order.get("custom_delivery_note_to_be_transported")
		dn_values = (
			frappe.db.get_value(
				"Delivery Note",
				dn,
				[
					"delivery_status",
					"driver",
					"vehicle_no",
					"transport_sales_invoice",
					"otp",
					"otp_expires_at",
					"transport_customer",
					"transport_customer_name",
				],
				as_dict=True,
			)
			if dn
			else None
		)
		raw_status = dn_values.delivery_status if dn_values else None
		order["delivery_status"] = _normalize_delivery_status(raw_status) if dn else None
		order["driver"] = dn_values.driver if dn_values else None
		order["vehicle_no"] = dn_values.vehicle_no if dn_values else None
		order["transport_sales_invoice"] = dn_values.transport_sales_invoice if dn_values else None
		order["transport_customer"] = dn_values.transport_customer if dn_values else None
		order["transport_customer_name"] = dn_values.transport_customer_name if dn_values else None
		order["zones"] = get_zones_for_transport_customer(order.get("transport_customer"))
		order["send_otp"] = get_transport_customer_send_otp(order.get("transport_customer"))
		order["otp"] = dn_values.otp if dn_values else None
		order["otp_expires_at"] = dn_values.otp_expires_at if dn_values else None
		order["otp_expired"] = bool(
			dn_values
			and dn_values.otp_expires_at
			and now_datetime() > dn_values.otp_expires_at
		)
		order["otp_missing"] = bool(dn and not (dn_values and dn_values.otp))

		main_invoice = get_main_company_invoice_for_delivery_note(dn) if dn else None
		if main_invoice:
			if order.get("custom_main_company_invoice") != main_invoice["name"]:
				sync_main_company_invoice_to_transport_order(dn, invoice_name=main_invoice["name"])
			order["custom_main_company_invoice"] = main_invoice["name"]
			order["custom_main_company_invoice_date"] = main_invoice["posting_date"]
		elif order.get("custom_main_company_invoice") and not order.get("custom_main_company_invoice_date"):
			order["custom_main_company_invoice_date"] = frappe.db.get_value(
				"Sales Invoice", order["custom_main_company_invoice"], "posting_date"
			)
	return orders


@frappe.whitelist()
def get_transport_order(name: str):
	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	return {
		"name": doc.name,
		"customer_name": doc.customer_name,
		"docstatus": doc.docstatus,
		"grand_total": doc.grand_total,
		"currency": doc.currency,
		"custom_delivery_note_to_be_transported": doc.custom_delivery_note_to_be_transported,
		"items": [
			{
				"name": row.name,
				"item_code": row.item_code,
				"item_name": row.item_name,
				"qty": row.qty,
				"rate": row.rate,
				"amount": row.amount,
				"uom": row.uom,
			}
			for row in doc.items
		],
	}


@frappe.whitelist()
def update_transport_order(
	name: str,
	qty: float | None = None,
	rate: float | None = None,
	custom_address_zone: str | None = None,
	custom_last_customer_invoice: str | None = None,
	custom_last_customer_invoice_date: str | None = None,
	custom_last_customer_delivery_note: str | None = None,
	custom_last_customer_delivery_note_date: str | None = None,
):
	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 0:
		frappe.throw(_("Only draft transport orders can be edited"))

	if not doc.items:
		frappe.throw(_("Transport order has no items"))

	row = doc.items[0]
	if qty is not None:
		row.qty = flt(qty)

	dn_name = doc.get("custom_delivery_note_to_be_transported")
	transport_customer = (
		frappe.db.get_value("Delivery Note", dn_name, "transport_customer") if dn_name else None
	)

	if custom_address_zone is not None and frappe.get_meta("Sales Order").has_field("custom_address_zone"):
		if custom_address_zone and transport_customer:
			valid = frappe.db.exists(
				"Address Zone Detail",
				{
					"parent": transport_customer,
					"parenttype": "Transport Customer",
					"zone": custom_address_zone,
				},
			)
			if not valid:
				frappe.throw(_("Selected address zone is not linked to this transport customer"))
		doc.custom_address_zone = custom_address_zone or None
		from ultrafreight.ultra_freight.api.transport_dispatch import resolve_transport_charge
		from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings

		goods_so = None
		if dn_name:
			goods_so = frappe.db.sql(
				"""
				SELECT against_sales_order
				FROM `tabDelivery Note Item`
				WHERE parent = %s AND IFNULL(against_sales_order, '') != ''
				LIMIT 1
				""",
				dn_name,
			)
			goods_so = goods_so[0][0] if goods_so else None
		row.rate = resolve_transport_charge(
			settings=get_transport_settings(),
			address_zone=doc.custom_address_zone,
			transport_customer=transport_customer,
			goods_sales_order_name=goods_so,
		)
	elif rate is not None:
		row.rate = flt(rate)

	row.amount = flt(row.qty) * flt(row.rate)

	# Keep Main Company Invoice in sync from the linked Delivery Note's goods invoice
	if dn_name:
		from ultrafreight.ultra_freight.api.transport_dispatch import get_main_company_invoice_for_delivery_note

		main_invoice = get_main_company_invoice_for_delivery_note(dn_name)
		if main_invoice:
			doc.custom_main_company_invoice = main_invoice["name"]
			doc.custom_main_company_invoice_date = main_invoice["posting_date"]

	if custom_last_customer_invoice is not None:
		doc.custom_last_customer_invoice = custom_last_customer_invoice
	if custom_last_customer_invoice_date is not None:
		doc.custom_last_customer_invoice_date = custom_last_customer_invoice_date or None
	if custom_last_customer_delivery_note is not None:
		doc.custom_last_customer_delivery_note = custom_last_customer_delivery_note
	if custom_last_customer_delivery_note_date is not None:
		doc.custom_last_customer_delivery_note_date = custom_last_customer_delivery_note_date or None

	doc.flags.ignore_permissions = True
	doc.calculate_taxes_and_totals()
	doc.save()
	return {
		"name": doc.name,
		"grand_total": doc.grand_total,
		"custom_address_zone": doc.get("custom_address_zone"),
		"rate": row.rate,
	}


@frappe.whitelist()
def submit_transport_order(name: str, send_otp: int | None = None):
	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 0:
		frappe.throw(_("Transport order is already submitted"))

	dn_name = doc.get("custom_delivery_note_to_be_transported")
	if dn_name and not frappe.db.get_value("Delivery Note", dn_name, "driver"):
		frappe.throw(_("Assign a driver before approving this order"))

	transport_customer = (
		frappe.db.get_value("Delivery Note", dn_name, "transport_customer") if dn_name else None
	)
	from ultrafreight.ultra_freight.api.transport_dispatch import (
		get_transport_customer_send_otp,
		get_zones_for_transport_customer,
	)
	from frappe.utils import cint

	zones = get_zones_for_transport_customer(transport_customer)
	if zones and frappe.get_meta("Sales Order").has_field("custom_address_zone"):
		if not doc.get("custom_address_zone"):
			frappe.throw(_("Select an address zone before approving this transport order"))

	if send_otp is None:
		send_otp = get_transport_customer_send_otp(transport_customer)
	send_otp = 1 if cint(send_otp) else 0
	frappe.flags.ultrafreight_send_otp = send_otp

	doc.flags.ignore_permissions = True
	doc.submit()
	return {"name": doc.name, "docstatus": doc.docstatus, "send_otp": send_otp}


MANAGER_DELIVERY_ROLES = ("Sales Manager", "System Manager", "Administrator", "Manager")


def _require_manager_delivery_role():
	roles = set(frappe.get_roles(frappe.session.user))
	if not roles.intersection(MANAGER_DELIVERY_ROLES):
		frappe.throw(_("Only Sales Manager or System Manager can mark delivery as delivered"), frappe.PermissionError)


@frappe.whitelist()
def mark_transport_order_delivered(name: str, completion_type: str = "Full", partial_reason: str | None = None):
	"""Mark In Transit delivery as Pending Invoicing (manager confirmation, no OTP)."""
	_require_login()
	_require_manager_delivery_role()
	_ensure_transport_sales_order(name)

	so = frappe.get_doc("Sales Order", name)
	if so.docstatus != 1:
		frappe.throw(_("Only submitted transport orders can be marked delivered"))

	dn_name = so.get("custom_delivery_note_to_be_transported")
	if not dn_name:
		frappe.throw(_("No delivery note linked to this transport order"))

	_ensure_transport_delivery_note(dn_name)
	doc = frappe.get_doc("Delivery Note", dn_name)
	status = _normalize_delivery_status(doc.get("delivery_status"))
	if status in ("Completed", "Pending Invoicing"):
		frappe.throw(_("Delivery already confirmed"))
	if status != "In Transit":
		frappe.throw(_("Delivery must be In Transit before it can be marked delivered"))

	completion_type = (completion_type or "Full").strip()
	if completion_type not in ("Full", "Partial"):
		frappe.throw(_("Completion type must be Full or Partial"))
	if completion_type == "Partial" and not (partial_reason or "").strip():
		frappe.throw(_("Please provide a reason for partial delivery"))

	delivered_items = []
	for row in doc.items:
		delivered_items.append(
			{
				"item_code": row.item_code,
				"item_name": row.item_name,
				"qty_ordered": row.qty,
				"qty_delivered": row.qty,
				"uom": row.uom,
			}
		)

	from ultrafreight.ultra_freight.api.notifications import (
		create_confirmation_log,
		notify_delivery_confirmed,
	)

	log_name = create_confirmation_log(
		delivery_note_name=doc.name,
		sales_order_name=name,
		driver_name=doc.get("driver"),
		transport_customer=doc.get("transport_customer"),
		otp=None,
		status="Pending Invoicing",
		completion_type=completion_type,
		partial_reason=partial_reason if completion_type == "Partial" else None,
		items=delivered_items,
		ip_address=frappe.local.request_ip if frappe.request else None,
		gps_location=None,
	)

	frappe.db.set_value(
		"Delivery Note",
		doc.name,
		{
			"delivery_status": "Pending Invoicing",
			"confirmation_log": log_name,
			"otp": None,
			"otp_generated_at": None,
			"otp_expires_at": None,
		},
		update_modified=True,
	)

	try:
		notify_delivery_confirmed(doc.name, name)
	except Exception:
		frappe.log_error(
			title=_("Ultra Dispatch Notification Failed"),
			message=frappe.get_traceback(),
		)

	return {
		"name": name,
		"delivery_note": doc.name,
		"delivery_status": "Pending Invoicing",
		"completion_type": completion_type,
		"confirmation_log": log_name,
	}


@frappe.whitelist()
def reschedule_transport_order(name: str, reason: str):
	"""Mark a draft transport order as rescheduled with a required reason."""
	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 0:
		frappe.throw(_("Only draft transport orders can be rescheduled"))

	reason = (reason or "").strip()
	if not reason:
		frappe.throw(_("Reschedule reason is required"))

	doc.custom_reschedule_transport_order = 1
	doc.custom_reason_for_reschedule = reason
	doc.flags.ignore_permissions = True
	doc.save()

	dn_name = doc.get("custom_delivery_note_to_be_transported")
	if dn_name:
		from ultrafreight.ultra_freight.api.notifications import create_confirmation_log

		create_confirmation_log(
			delivery_note_name=dn_name,
			sales_order_name=name,
			driver_name=frappe.db.get_value("Delivery Note", dn_name, "driver"),
			transport_customer=frappe.db.get_value("Delivery Note", dn_name, "transport_customer"),
			status="Open",
			partial_reason=reason,
		)

	return {
		"name": doc.name,
		"custom_reschedule_transport_order": 1,
		"custom_reason_for_reschedule": reason,
	}


@frappe.whitelist()
def cancel_transport_order(name: str, reason: str | None = None):
	"""Cancel a submitted transport order and reopen the linked delivery for re-dispatch."""
	from ultrafreight.ultra_freight.api.notifications import create_confirmation_log
	from ultrafreight.ultra_freight.api.transport_dispatch import create_transport_sales_order

	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 1:
		frappe.throw(_("Only submitted transport orders can be cancelled"))

	dn_name = doc.get("custom_delivery_note_to_be_transported")
	if dn_name:
		existing_invoice = frappe.db.get_value("Delivery Note", dn_name, "transport_sales_invoice")
		if existing_invoice:
			frappe.throw(
				_(
					"Transport invoice {0} already exists. Create a credit note for the invoice instead of cancelling this order."
				).format(existing_invoice)
			)
		dn_status = frappe.db.get_value("Delivery Note", dn_name, "delivery_status")
		dn_status = _normalize_delivery_status(dn_status)
		if dn_status == "Pending Invoicing":
			frappe.throw(_("Cannot cancel — delivery is already confirmed and pending invoicing"))
		if dn_status == "Completed":
			frappe.throw(_("Cannot cancel a transport order for a completed delivery"))
		if dn_status != "In Transit":
			frappe.throw(_("Only In Transit transport orders can be cancelled"))

	doc.flags.ignore_permissions = True
	doc.cancel()

	new_transport_order = None
	if dn_name:
		frappe.db.set_value(
			"Delivery Note",
			dn_name,
			{
				"delivery_status": "Open",
				"otp": None,
				"otp_generated_at": None,
				"otp_expires_at": None,
				"transport_sales_order": None,
			},
			update_modified=True,
		)
		create_confirmation_log(
			delivery_note_name=dn_name,
			sales_order_name=name,
			driver_name=frappe.db.get_value("Delivery Note", dn_name, "driver"),
			transport_customer=frappe.db.get_value("Delivery Note", dn_name, "transport_customer"),
			status="Failed",
			partial_reason=(reason or "").strip() or _("Transport order cancelled"),
		)
		new_transport_order = create_transport_sales_order(dn_name)

	return {
		"name": name,
		"docstatus": 2,
		"delivery_status": "Open" if dn_name else None,
		"new_transport_order": new_transport_order,
	}


@frappe.whitelist()
def regenerate_transport_otp(name: str):
	"""Regenerate OTP for an approved transport order (missing or expired)."""
	from ultrafreight.ultra_freight.api.transport_dispatch import regenerate_otp_for_transport_order

	_require_login()
	_ensure_transport_sales_order(name)
	result = regenerate_otp_for_transport_order(name, notify=True)
	return result


@frappe.whitelist()
def create_transport_invoice(
	name: str,
	custom_note: str | None = None,
	custom_final_customer_feedback_document: str | None = None,
):
	"""Create transport Sales Invoice from a submitted transport order and mark delivery Completed."""
	from ultrafreight.ultra_freight.api.notifications import create_confirmation_log
	from ultrafreight.ultra_freight.api.transport_dispatch import create_transport_sales_invoice_from_order

	_require_login()
	_ensure_transport_sales_order(name)
	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 1:
		frappe.throw(_("Approve the transport order before creating an invoice"))

	dn_name = doc.get("custom_delivery_note_to_be_transported")
	if not dn_name:
		frappe.throw(_("Delivery Note To Be Transported is required"))

	_ensure_transport_delivery_note(dn_name)
	dn_status = frappe.db.get_value("Delivery Note", dn_name, "delivery_status")
	if dn_status != "Pending Invoicing":
		frappe.throw(
			_("Invoice can only be created when delivery status is Pending Invoicing (current: {0})").format(
				dn_status or "Open"
			)
		)

	existing = frappe.db.get_value("Delivery Note", dn_name, "transport_sales_invoice")
	if existing:
		frappe.throw(_("Transport invoice {0} already exists for this delivery").format(existing))

	so_updates = {}
	if custom_note is not None:
		so_updates["custom_note"] = custom_note
	if custom_final_customer_feedback_document is not None:
		so_updates["custom_final_customer_feedback_document"] = custom_final_customer_feedback_document
	if so_updates:
		frappe.db.set_value("Sales Order", name, so_updates, update_modified=True)

	invoice_name = create_transport_sales_invoice_from_order(name)
	driver_name = frappe.db.get_value("Delivery Note", dn_name, "driver")
	transport_customer = frappe.db.get_value("Delivery Note", dn_name, "transport_customer")

	create_confirmation_log(
		delivery_note_name=dn_name,
		sales_order_name=name,
		driver_name=driver_name,
		transport_customer=transport_customer,
		status="Completed",
	)

	frappe.db.set_value(
		"Delivery Note",
		dn_name,
		{
			"delivery_status": "Completed",
			"transport_sales_invoice": invoice_name,
		},
		update_modified=True,
	)

	return {
		"name": name,
		"sales_invoice": invoice_name,
		"delivery_note": dn_name,
		"delivery_status": "Completed",
	}


@frappe.whitelist()
def assign_dispatch_driver(delivery_note: str, driver: str, vehicle_no: str | None = None):
	_require_login()
	_ensure_transport_delivery_note(delivery_note)
	doc = frappe.get_doc("Delivery Note", delivery_note)
	if doc.delivery_status not in ("Open", "", None):
		frappe.throw(_("Driver can only be changed while delivery status is Open"))
	_ensure_driver_access(driver)
	if frappe.db.get_value("Driver", driver, "status") != "Active":
		frappe.throw(_("Selected driver is not active"))

	vehicle_no = (vehicle_no or "").strip() or None
	if vehicle_no and frappe.db.exists("DocType", "Vehicle"):
		if not frappe.db.exists("Vehicle", vehicle_no):
			frappe.throw(_("Selected truck / vehicle is not valid"))

	updates = {"driver": driver}
	if frappe.get_meta("Delivery Note").has_field("vehicle_no"):
		updates["vehicle_no"] = vehicle_no

	frappe.db.set_value("Delivery Note", delivery_note, updates, update_modified=True)
	return {"delivery_note": delivery_note, "driver": driver, "vehicle_no": vehicle_no}


@frappe.whitelist()
def get_vehicles():
	"""List trucks/vehicles for the transport company (ERPNext Vehicle)."""
	_require_login()
	if not frappe.db.exists("DocType", "Vehicle"):
		return []

	company = _transport_company()
	filters = {}
	if company and frappe.get_meta("Vehicle").has_field("company"):
		filters["company"] = company

	fields = ["name", "license_plate", "make", "model"]
	meta = frappe.get_meta("Vehicle")
	if meta.has_field("company"):
		fields.append("company")

	rows = frappe.get_all(
		"Vehicle",
		filters=filters,
		fields=fields,
		order_by="license_plate asc",
		limit_page_length=500,
	)
	# If company filter returned nothing, fall back to all vehicles
	if company and filters and not rows:
		rows = frappe.get_all(
			"Vehicle",
			fields=fields,
			order_by="license_plate asc",
			limit_page_length=500,
		)
	return rows


@frappe.whitelist()
def update_dispatch_transport_customer(
	delivery_note: str,
	transport_customer_name: str | None = None,
	transport_phone: str | None = None,
	transport_email: str | None = None,
	transport_address: str | None = None,
):
	_require_login()
	_ensure_transport_delivery_note(delivery_note)
	doc = frappe.get_doc("Delivery Note", delivery_note)
	if doc.delivery_status not in ("Open", "", None):
		frappe.throw(_("Transport customer details can only be edited while delivery status is Open"))

	updates = {}
	if transport_customer_name is not None:
		updates["transport_customer_name"] = transport_customer_name
	if transport_phone is not None:
		updates["transport_phone"] = transport_phone
	if transport_email is not None:
		updates["transport_email"] = transport_email
	if transport_address is not None:
		updates["transport_address"] = transport_address
	if updates:
		frappe.db.set_value("Delivery Note", delivery_note, updates, update_modified=True)
	return {"delivery_note": delivery_note, **updates}


@frappe.whitelist()
def get_drivers(include_inactive: int | str = 0):
	_require_login()
	company = _transport_company()
	filters = {}
	if not int(include_inactive):
		filters["status"] = "Active"
	if company:
		filters["transport_company"] = company

	return frappe.get_all(
		"Driver",
		filters=filters,
		fields=[
			"name",
			"full_name",
			"cell_number",
			"vehicle_number",
			"transport_company",
			"unique_key",
			"status",
		],
		order_by="full_name asc",
	)


@frappe.whitelist()
def create_driver(
	full_name: str,
	cell_number: str,
	vehicle_number: str | None = None,
):
	_require_login()
	if not full_name or not cell_number:
		frappe.throw(_("Full name and phone number are required"))

	company = _transport_company()
	doc = frappe.get_doc(
		{
			"doctype": "Driver",
			"full_name": full_name.strip(),
			"cell_number": cell_number.strip(),
			"vehicle_number": vehicle_number or "",
			"status": "Active",
			"transport_company": company,
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	return {
		"name": doc.name,
		"full_name": doc.full_name,
		"cell_number": doc.cell_number,
		"vehicle_number": doc.vehicle_number,
		"unique_key": doc.unique_key,
		"status": doc.status,
	}


@frappe.whitelist()
def update_driver(
	name: str,
	full_name: str | None = None,
	cell_number: str | None = None,
	vehicle_number: str | None = None,
	status: str | None = None,
):
	_require_login()
	_ensure_driver_access(name)
	doc = frappe.get_doc("Driver", name)
	if full_name is not None:
		doc.full_name = full_name.strip()
	if cell_number is not None:
		doc.cell_number = cell_number.strip()
	if vehicle_number is not None:
		doc.vehicle_number = vehicle_number
	if status is not None:
		if status not in ("Active", "Suspended", "Left"):
			frappe.throw(_("Invalid driver status"))
		doc.status = status
	doc.flags.ignore_permissions = True
	doc.save()
	return {
		"name": doc.name,
		"full_name": doc.full_name,
		"cell_number": doc.cell_number,
		"vehicle_number": doc.vehicle_number,
		"unique_key": doc.unique_key,
		"status": doc.status,
	}


@frappe.whitelist()
def deactivate_driver(name: str):
	_require_login()
	return update_driver(name, status="Left")


@frappe.whitelist()
def regenerate_driver_key(name: str):
	_require_login()
	_ensure_driver_access(name)
	doc = frappe.get_doc("Driver", name)
	doc.unique_key = ""
	doc.flags.ignore_permissions = True
	doc.save()
	return {"name": doc.name, "unique_key": doc.unique_key}


@frappe.whitelist()
def get_active_otps():
	_require_login()
	filters = {
		**_dispatch_filters(),
		"otp": ("is", "set"),
		"delivery_status": "In Transit",
	}
	records = frappe.get_all(
		"Delivery Note",
		filters=filters,
		fields=[
			"name",
			"customer_name",
			"transport_customer_name",
			"driver",
			"otp",
			"otp_generated_at",
			"otp_expires_at",
			"delivery_status",
			"transport_sales_order",
		],
		order_by="otp_generated_at desc",
		limit=100,
	)
	now = now_datetime()
	for row in records:
		row["is_expired"] = bool(row.otp_expires_at and now > row.otp_expires_at)
	return records


@frappe.whitelist()
def get_transport_invoices():
	_require_login()
	dn_filters = {**_dispatch_filters(), "transport_sales_invoice": ("is", "set")}
	invoice_names = frappe.get_all(
		"Delivery Note",
		filters=dn_filters,
		pluck="transport_sales_invoice",
	)
	if not invoice_names:
		return []

	return frappe.get_all(
		"Sales Invoice",
		filters={"name": ("in", invoice_names)},
		fields=[
			"name",
			"customer",
			"customer_name",
			"posting_date",
			"grand_total",
			"outstanding_amount",
			"status",
			"docstatus",
			"currency",
		],
		order_by="posting_date desc",
		limit=100,
	)


@frappe.whitelist()
def get_portal_print_defaults(doctype: str | None = None):
	"""Defaults from Transport Settings for direct portal printing."""
	_require_login()
	settings = get_transport_settings()
	print_format = settings.get("default_print_format")
	letter_head = settings.get("default_letter_head")

	if doctype and print_format and print_format != "Standard":
		pf_doctype = frappe.db.get_value("Print Format", print_format, "doc_type")
		if pf_doctype and pf_doctype != doctype:
			# Settings format is for another DocType — fall back to that doctype's default
			print_format = frappe.get_meta(doctype).default_print_format or "Standard"
	elif doctype and not print_format:
		print_format = frappe.get_meta(doctype).default_print_format or "Standard"

	return {
		"print_format": print_format or "Standard",
		"letter_head": letter_head,
	}


@frappe.whitelist()
def get_payment_modes():
	"""Modes of Payment available for the transport company."""
	_require_login()
	company = _transport_company()
	modes = frappe.get_all(
		"Mode of Payment",
		filters={"enabled": 1},
		fields=["name", "type"],
		order_by="name asc",
	)
	if not company:
		return modes

	# Prefer modes that have an account mapped for this company
	mapped = {
		row.parent
		for row in frappe.get_all(
			"Mode of Payment Account",
			filters={"company": company},
			fields=["parent"],
		)
	}
	if mapped:
		return [m for m in modes if m.name in mapped] or modes
	return modes


@frappe.whitelist()
def create_transport_payment(
	sales_invoice: str,
	mode_of_payment: str | None = None,
	paid_amount: float | None = None,
):
	"""Create and submit a Payment Entry against a transport Sales Invoice."""
	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	from ultrafreight.ultra_freight.api.transport_dispatch import _apply_transport_accounting_dimensions

	_require_login()
	if not sales_invoice or not frappe.db.exists("Sales Invoice", sales_invoice):
		frappe.throw(_("Sales Invoice not found"))
	if not mode_of_payment:
		frappe.throw(_("Payment method is required"))

	linked = frappe.db.exists(
		"Delivery Note",
		{**_dispatch_filters(), "transport_sales_invoice": sales_invoice},
	)
	if not linked:
		frappe.throw(_("This invoice is not a transport invoice for your company"))

	si = frappe.get_doc("Sales Invoice", sales_invoice)
	if si.docstatus != 1:
		frappe.throw(_("Invoice must be submitted before creating a payment"))

	outstanding = flt(si.outstanding_amount)
	if outstanding <= 0:
		frappe.throw(_("Invoice {0} has no outstanding amount").format(sales_invoice))

	amount = flt(paid_amount if paid_amount is not None else outstanding)
	if amount <= 0:
		frappe.throw(_("Paid amount must be greater than zero"))
	if amount > outstanding:
		frappe.throw(
			_("Paid amount cannot exceed outstanding amount {0}").format(
				frappe.format(outstanding, {"fieldtype": "Currency", "options": si.currency})
			)
		)

	if not frappe.db.exists("Mode of Payment", mode_of_payment):
		frappe.throw(_("Invalid payment method {0}").format(mode_of_payment))

	account = frappe.db.get_value(
		"Mode of Payment Account",
		{"parent": mode_of_payment, "company": si.company},
		"default_account",
	)
	if not account:
		frappe.throw(
			_("Set a default account for Mode of Payment {0} on company {1}").format(
				mode_of_payment, si.company
			)
		)

	pe = get_payment_entry("Sales Invoice", sales_invoice, bank_account=account)
	pe.mode_of_payment = mode_of_payment
	pe.paid_amount = amount
	pe.received_amount = amount
	if pe.payment_type == "Receive":
		pe.paid_to = account
	else:
		pe.paid_from = account

	for ref in pe.get("references") or []:
		ref.allocated_amount = min(flt(ref.outstanding_amount) or amount, amount)

	_apply_transport_accounting_dimensions(pe)
	pe.flags.ignore_permissions = True
	pe.insert()
	pe.submit()
	return {
		"payment_entry": pe.name,
		"sales_invoice": sales_invoice,
		"paid_amount": pe.paid_amount,
		"mode_of_payment": pe.mode_of_payment,
		"currency": pe.paid_to_account_currency or pe.paid_from_account_currency or si.currency,
	}


@frappe.whitelist()
def get_confirmation_logs(delivery_note: str | None = None):
	_require_login()
	filters = {}
	if delivery_note:
		filters["delivery_note"] = delivery_note

	logs = frappe.get_all(
		"Delivery Confirmation Log",
		filters=filters,
		fields=[
			"name",
			"delivery_note",
			"sales_order",
			"driver",
			"transport_customer",
			"otp",
			"confirmation_time",
			"status",
			"completion_type",
			"partial_reason",
		],
		order_by="confirmation_time desc",
		limit=100,
	)
	confirmation_logs = []
	for log in logs:
		row = dict(log)
		row["items"] = _get_confirmation_log_items(row["name"])
		confirmation_logs.append(row)
	return confirmation_logs


@frappe.whitelist()
def get_sms_logs(delivery_note: str | None = None):
	_require_login()
	if delivery_note:
		if not frappe.db.exists("Delivery Note", delivery_note):
			return []
		if delivery_note not in _get_linked_delivery_notes():
			if not frappe.has_permission("Delivery Note", "read", delivery_note):
				frappe.throw(_("This delivery note is not linked to your transport company"))
			return get_delivery_sms_logs(delivery_note)
		return get_delivery_sms_logs(delivery_note)

	dn_names = _get_linked_delivery_notes()
	if not dn_names:
		return []

	if not frappe.db.exists("DocType", "Delivery SMS Log"):
		return []

	return frappe.get_all(
		"Delivery SMS Log",
		filters={"delivery_note": ("in", dn_names)},
		fields=[
			"name",
			"delivery_note",
			"party",
			"event",
			"recipient",
			"recipient_label",
			"message",
			"status",
			"sent_at",
			"error",
			"creation",
		],
		order_by="creation desc",
		limit=200,
	)


@frappe.whitelist()
def get_email_logs(delivery_note: str | None = None):
	_require_login()
	if delivery_note:
		if not frappe.db.exists("Delivery Note", delivery_note):
			return []
		if delivery_note not in _get_linked_delivery_notes():
			if not frappe.has_permission("Delivery Note", "read", delivery_note):
				frappe.throw(_("This delivery note is not linked to your transport company"))
			return get_delivery_email_logs(delivery_note)
		return get_delivery_email_logs(delivery_note)

	dn_names = _get_linked_delivery_notes()
	if not dn_names:
		return []

	if not frappe.db.exists("DocType", "Delivery Email Log"):
		return []

	return frappe.get_all(
		"Delivery Email Log",
		filters={"delivery_note": ("in", dn_names)},
		fields=[
			"name",
			"delivery_note",
			"party",
			"event",
			"recipient",
			"recipient_label",
			"subject",
			"message",
			"status",
			"sent_at",
			"error",
			"creation",
		],
		order_by="creation desc",
		limit=200,
	)
