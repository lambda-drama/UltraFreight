import json

import frappe
from frappe import _
from frappe.utils import flt, now_datetime

from ultrafreight.ultra_freight.api.notifications import (
	create_confirmation_log,
	notify_delivery_confirmed,
)


@frappe.whitelist()
def mark_in_transit(delivery_note: str):
	frappe.throw(_("Status is set to In Transit automatically when the transport order is submitted"))


@frappe.whitelist()
def mark_arrived(delivery_note: str):
	frappe.throw(_("Arrived status is no longer used. Drivers confirm delivery from the transport portal"))


@frappe.whitelist(allow_guest=True)
def get_active_drivers():
	return frappe.get_all(
		"Driver",
		filters={"status": "Active"},
		fields=["name", "full_name", "cell_number", "vehicle_number"],
		order_by="full_name asc",
	)


def _get_verified_driver(driver: str, unique_key: str) -> dict:
	driver_doc = frappe.db.get_value(
		"Driver",
		{"name": driver, "status": "Active"},
		["name", "full_name", "unique_key"],
		as_dict=True,
	)
	if not driver_doc:
		frappe.throw(_("Invalid driver selected"), frappe.AuthenticationError)
	if driver_doc.unique_key != unique_key:
		frappe.throw(_("Driver key does not match the selected driver"), frappe.AuthenticationError)
	return driver_doc


def _get_delivery_items(delivery_note_name: str) -> list[dict]:
	return frappe.get_all(
		"Delivery Note Item",
		filters={"parent": delivery_note_name},
		fields=["item_name", "item_code", "qty", "uom"],
	)


def _get_linked_sales_order(doc) -> str | None:
	for item in doc.items:
		if item.against_sales_order:
			return item.against_sales_order
	return None


def _get_transport_sales_order(delivery_note: str) -> str | None:
	return frappe.db.get_value(
		"Sales Order",
		{
			"custom_is_transport_order": 1,
			"custom_delivery_note_to_be_transported": delivery_note,
			"docstatus": 1,
		},
		"name",
	)


def _delivery_has_otp(delivery_note_name: str) -> bool:
	otp = frappe.db.get_value("Delivery Note", delivery_note_name, "otp")
	return bool(otp and str(otp).strip())


def _build_full_delivered_items(doc) -> list[dict]:
	return [
		{
			"item_code": row.item_code,
			"item_name": row.item_name,
			"qty_ordered": row.qty,
			"qty_delivered": row.qty,
			"uom": row.uom,
		}
		for row in doc.items
	]


def _finalize_delivery_confirmation(
	doc,
	*,
	driver_name: str,
	sales_order: str | None,
	transport_sales_order: str | None,
	otp: str | None,
	completion_type: str,
	partial_reason: str | None,
	delivered_items: list[dict],
	gps_location: str | None,
	completed_without_otp: bool = False,
):
	log_name = create_confirmation_log(
		delivery_note_name=doc.name,
		sales_order_name=transport_sales_order or sales_order,
		driver_name=driver_name,
		transport_customer=doc.get("transport_customer"),
		otp=otp,
		status="Pending Invoicing",
		completion_type=completion_type,
		partial_reason=partial_reason if completion_type == "Partial" else None,
		items=delivered_items,
		ip_address=frappe.local.request_ip if frappe.request else None,
		gps_location=gps_location,
	)

	frappe.db.set_value(
		"Delivery Note",
		doc.name,
		{
			"delivery_status": "Pending Invoicing",
			"confirmation_log": log_name,
		},
		update_modified=True,
	)

	if completed_without_otp and transport_sales_order:
		if frappe.get_meta("Sales Order").has_field("custom_completed_without_otp"):
			frappe.db.set_value(
				"Sales Order",
				transport_sales_order,
				"custom_completed_without_otp",
				1,
				update_modified=True,
			)

	notify_delivery_confirmed(doc.name, transport_sales_order or sales_order)

	return {
		"status": "Pending Invoicing",
		"completion_type": completion_type,
		"confirmation_log": log_name,
		"sales_invoice": doc.get("transport_sales_invoice"),
		"completed_without_otp": 1 if completed_without_otp else 0,
		"transport_sales_order": transport_sales_order,
	}


@frappe.whitelist(allow_guest=True)
def get_driver_assignments(driver: str, unique_key: str):
	driver_doc = _get_verified_driver(driver, unique_key)
	assignments = frappe.get_all(
		"Delivery Note",
		filters={
			"driver": driver_doc.name,
			"docstatus": 1,
			"require_direct_delivery": 1,
			"delivery_status": "In Transit",
		},
		fields=[
			"name",
			"transport_customer_name",
			"transport_address",
			"transport_phone",
			"delivery_status",
			"otp_expires_at",
			"otp",
		],
		order_by="modified desc",
	)
	for row in assignments:
		row["items"] = _get_delivery_items(row.name)
		row["requires_otp"] = bool(row.get("otp") and str(row.get("otp")).strip())
		row.pop("otp", None)
	return {"driver_name": driver_doc.full_name, "assignments": assignments}


@frappe.whitelist(allow_guest=True)
def get_driver_assignments_without_otp(driver: str, unique_key: str):
	"""In-transit deliveries assigned to this driver that were initiated without OTP."""
	driver_doc = _get_verified_driver(driver, unique_key)
	assignments = frappe.get_all(
		"Delivery Note",
		filters={
			"driver": driver_doc.name,
			"docstatus": 1,
			"require_direct_delivery": 1,
			"delivery_status": "In Transit",
		},
		fields=[
			"name",
			"transport_customer_name",
			"transport_address",
			"transport_phone",
			"delivery_status",
			"otp",
		],
		order_by="modified desc",
	)
	without_otp = []
	for row in assignments:
		if row.get("otp") and str(row.get("otp")).strip():
			continue
		row["items"] = _get_delivery_items(row.name)
		row.pop("otp", None)
		row["requires_otp"] = False
		without_otp.append(row)

	return {"driver_name": driver_doc.full_name, "assignments": without_otp}


@frappe.whitelist(allow_guest=True)
def verify_driver_otp(driver: str, unique_key: str, otp: str):
	driver_doc = _get_verified_driver(driver, unique_key)

	delivery_note = frappe.db.get_value(
		"Delivery Note",
		{
			"otp": otp,
			"driver": driver_doc.name,
			"docstatus": 1,
			"delivery_status": "In Transit",
		},
		[
			"name",
			"otp_expires_at",
			"transport_customer_name",
			"transport_address",
			"delivery_status",
		],
		as_dict=True,
	)
	if not delivery_note:
		frappe.throw(_("Invalid OTP or no matching delivery found"), frappe.AuthenticationError)

	if delivery_note.otp_expires_at and now_datetime() > delivery_note.otp_expires_at:
		frappe.throw(_("OTP has expired"), frappe.AuthenticationError)

	return {
		"delivery_note": delivery_note.name,
		"customer_name": delivery_note.transport_customer_name,
		"address": delivery_note.transport_address,
		"delivery_status": delivery_note.delivery_status,
		"items": _get_delivery_items(delivery_note.name),
		"driver_name": driver_doc.full_name,
		"requires_otp": True,
	}


@frappe.whitelist(allow_guest=True)
def confirm_delivery(
	driver: str,
	unique_key: str,
	otp: str,
	delivery_note: str,
	completion_type: str = "Full",
	partial_reason: str | None = None,
	items: str | None = None,
	gps_location: str | None = None,
):
	if isinstance(items, str) and items:
		items = json.loads(items)
	elif not items:
		items = None

	verification = verify_driver_otp(driver, unique_key, otp)
	if verification.get("delivery_note") != delivery_note:
		frappe.throw(_("Delivery Note mismatch"), frappe.AuthenticationError)

	doc = frappe.get_doc("Delivery Note", delivery_note)
	if doc.delivery_status in ("Completed", "Pending Invoicing"):
		frappe.throw(_("Delivery already confirmed"))

	driver_doc = _get_verified_driver(driver, unique_key)
	sales_order = _get_linked_sales_order(doc)
	transport_sales_order = _get_transport_sales_order(doc.name)
	dn_items = {row.item_code: row for row in doc.items}

	completion_type = (completion_type or "Full").strip()
	if completion_type not in ("Full", "Partial"):
		frappe.throw(_("Completion type must be Full or Partial"))

	if completion_type == "Partial" and not (partial_reason or "").strip():
		frappe.throw(_("Please provide a reason for partial delivery"))

	delivered_items = []
	if completion_type == "Full":
		delivered_items = _build_full_delivered_items(doc)
	else:
		if not items:
			frappe.throw(_("Please enter quantities delivered for each item"))
		for row in items:
			item_code = row.get("item_code")
			if item_code not in dn_items:
				frappe.throw(_("Item {0} is not part of this delivery").format(item_code))
			qty_delivered = flt(row.get("qty_delivered"))
			qty_ordered = flt(dn_items[item_code].qty)
			if qty_delivered < 0:
				frappe.throw(_("Delivered quantity cannot be negative for {0}").format(item_code))
			if qty_delivered > qty_ordered:
				frappe.throw(_("Delivered quantity cannot exceed ordered quantity for {0}").format(item_code))
			delivered_items.append(
				{
					"item_code": item_code,
					"item_name": dn_items[item_code].item_name,
					"qty_ordered": qty_ordered,
					"qty_delivered": qty_delivered,
					"uom": dn_items[item_code].uom,
				}
			)

		all_full = all(flt(row["qty_delivered"]) >= flt(row["qty_ordered"]) for row in delivered_items)
		any_delivered = any(flt(row["qty_delivered"]) > 0 for row in delivered_items)
		if not any_delivered:
			frappe.throw(_("At least one item must have a delivered quantity"))
		if all_full:
			completion_type = "Full"
			partial_reason = None

	return _finalize_delivery_confirmation(
		doc,
		driver_name=driver_doc.name,
		sales_order=sales_order,
		transport_sales_order=transport_sales_order,
		otp=otp,
		completion_type=completion_type,
		partial_reason=partial_reason,
		delivered_items=delivered_items,
		gps_location=gps_location,
		completed_without_otp=False,
	)


@frappe.whitelist(allow_guest=True)
def confirm_delivery_without_otp(
	driver: str,
	unique_key: str,
	delivery_note: str,
	gps_location: str | None = None,
):
	"""Confirm an In Transit delivery that was initiated without OTP (driver + PIN only)."""
	driver_doc = _get_verified_driver(driver, unique_key)
	doc = frappe.get_doc("Delivery Note", delivery_note)

	if doc.driver != driver_doc.name:
		frappe.throw(_("This delivery is not assigned to the selected driver"), frappe.AuthenticationError)
	if doc.docstatus != 1:
		frappe.throw(_("Delivery Note must be submitted"))
	if doc.delivery_status in ("Completed", "Pending Invoicing"):
		frappe.throw(_("Delivery already confirmed"))
	if doc.delivery_status != "In Transit":
		frappe.throw(_("Delivery must be In Transit before it can be confirmed"))
	if _delivery_has_otp(doc.name):
		frappe.throw(_("This delivery requires OTP confirmation"))

	sales_order = _get_linked_sales_order(doc)
	transport_sales_order = _get_transport_sales_order(doc.name)
	delivered_items = _build_full_delivered_items(doc)

	return _finalize_delivery_confirmation(
		doc,
		driver_name=driver_doc.name,
		sales_order=sales_order,
		transport_sales_order=transport_sales_order,
		otp=None,
		completion_type="Full",
		partial_reason=None,
		delivered_items=delivered_items,
		gps_location=gps_location,
		completed_without_otp=True,
	)
