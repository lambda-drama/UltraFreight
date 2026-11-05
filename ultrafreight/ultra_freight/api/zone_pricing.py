"""Keep draft transport Sales Order prices in sync with Address Zone amounts.

A transport order is billed from a single transport service line, and that line's
rate comes from the ``Address Zone`` master (``transport_charges``).

Three flows use this module:

* the **Update Zone Prices** button on Sales Order (form and list) opens a dialog
  with every draft transport order, so a user can pick the orders — and the zone
  for each of them — and push the zone amount into the order price;
* saving an ``Address Zone`` with a new amount re-prices every draft transport
  order that follows that zone (``sync_draft_transport_orders_on_zone_update``);
* **Update Draft Transport Prices** on Transport Settings re-prices every draft
  transport order from its current zone amount, including older orders that were
  never touched by a later zone change.
"""

from __future__ import annotations

import json

import frappe
from frappe import _
from frappe.utils import cint, flt

from ultrafreight.ultra_freight.api.transport_dispatch import (
	get_default_zone_for_transport_customer,
)
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings
from ultrafreight.ultra_freight.utils.zone_field import (
	ZONE_FIELD_CANDIDATES,
	get_order_zone,
	get_zone_fieldname,  # re-exported for callers that need a single field name
	get_zone_fields,
	set_order_zone,
)

MAX_ORDERS = 500
SYNC_FLAG = "ultrafreight_zone_price_sync"


def get_zone_amount(zone: str | None) -> float | None:
	"""Amount configured on the Address Zone master."""
	if not zone:
		return None
	amount = flt(frappe.db.get_value("Address Zone", zone, "transport_charges"))
	return amount or None


def get_order_transport_customer(order) -> str | None:
	"""Transport customer of an order, falling back to the linked Delivery Note."""
	transport_customer = order.get("transport_customer")
	if transport_customer:
		return transport_customer

	delivery_note = order.get("custom_delivery_note_to_be_transported")
	if delivery_note:
		return frappe.db.get_value("Delivery Note", delivery_note, "transport_customer")
	return None


def _resolve_zone(
	zone: str | None,
	customer_zones: list | None,
	transport_customer: str | None,
) -> tuple[str | None, str | None]:
	"""Resolve the zone of an order and describe where it came from."""
	if zone and frappe.db.exists("Address Zone", zone):
		return zone, _("Zone on order")

	rows = [row for row in (customer_zones or []) if row.get("zone")]
	if rows:
		for row in rows:
			if cint(row.get("default")):
				return row.get("zone"), _("Default customer zone")
		if len(rows) == 1:
			return rows[0].get("zone"), _("Single customer zone")

	default_zone = get_default_zone_for_transport_customer(transport_customer)
	if default_zone and default_zone.get("zone"):
		return default_zone.get("zone"), _("Transport Customer default zone")

	return None, None


def resolve_order_zone(order) -> tuple[str | None, str | None]:
	"""Resolve the zone of a loaded Sales Order document."""
	return _resolve_zone(
		get_order_zone(order),
		order.get("custom_customer_zone") or [],
		get_order_transport_customer(order),
	)


def _get_transport_rows(doc) -> list:
	"""Rows carrying the transport charge (all items on a transport order)."""
	settings = get_transport_settings()
	transport_item = settings.get("default_transport_item")
	rows = list(doc.items or [])
	if transport_item:
		matched = [row for row in rows if row.item_code == transport_item]
		if matched:
			return matched
	return rows


def _parse_names(names) -> list[str]:
	if isinstance(names, str):
		names = names.strip()
		if not names:
			return []
		names = json.loads(names) if names.startswith("[") else names.split(",")
	elif not names:
		return []

	parsed: list[str] = []
	for name in names:
		name = str(name).strip()
		if name and name not in parsed:
			parsed.append(name)
	return parsed


def _parse_zone_map(zones) -> dict[str, str | None]:
	if isinstance(zones, str):
		zones = zones.strip()
		zones = json.loads(zones) if zones else {}
	if not isinstance(zones, dict):
		return {}
	return {
		str(name).strip(): (str(zone).strip() or None)
		for name, zone in zones.items()
		if str(name).strip()
	}


def _get_zone_catalog() -> list[dict]:
	return frappe.get_all(
		"Address Zone",
		fields=["name", "zone_name", "zone_city", "transport_charges"],
		order_by="zone_name asc",
		limit=0,
	)


def _build_preview(search: str | None = None, limit: int = 200) -> dict:
	filters = {"docstatus": 0, "custom_is_transport_order": 1}
	or_filters = None
	search = (search or "").strip()
	if search:
		like = f"%{search}%"
		or_filters = [
			["name", "like", like],
			["customer", "like", like],
			["customer_name", "like", like],
			["transport_customer", "like", like],
		]

	fields = [
		"name",
		"customer",
		"customer_name",
		"transaction_date",
		"grand_total",
		"currency",
		"transport_customer",
		"custom_delivery_note_to_be_transported",
	]
	zone_fields = get_zone_fields()
	fields.extend(zone_fields)

	orders = frappe.get_all(
		"Sales Order",
		filters=filters,
		or_filters=or_filters,
		fields=fields,
		order_by="modified desc",
		limit=limit,
	)
	names = [order.name for order in orders]

	items_by_parent: dict[str, list] = {name: [] for name in names}
	zones_by_parent: dict[str, list] = {name: [] for name in names}
	transport_customer_by_dn: dict[str, str | None] = {}

	if names:
		for row in frappe.get_all(
			"Sales Order Item",
			filters={"parent": ("in", names)},
			fields=["parent", "item_code", "qty", "rate", "amount"],
			order_by="idx asc",
			limit=0,
		):
			items_by_parent.setdefault(row.parent, []).append(row)

		for row in frappe.get_all(
			"Address Zone Detail",
			filters={"parenttype": "Sales Order", "parent": ("in", names)},
			fields=["parent", "zone", "transport_charges", "default", "idx"],
			order_by="idx asc",
			limit=0,
		):
			zones_by_parent.setdefault(row.parent, []).append(row)

		delivery_notes = [
			order.get("custom_delivery_note_to_be_transported")
			for order in orders
			if order.get("custom_delivery_note_to_be_transported")
		]
		if delivery_notes:
			transport_customer_by_dn = {
				row.name: row.transport_customer
				for row in frappe.get_all(
					"Delivery Note",
					filters={"name": ("in", delivery_notes)},
					fields=["name", "transport_customer"],
					limit=0,
				)
			}

	settings = get_transport_settings()
	transport_item = settings.get("default_transport_item")
	zone_catalog = _get_zone_catalog()
	zone_amounts = {zone.name: flt(zone.transport_charges) for zone in zone_catalog}

	rows = []
	for order in orders:
		items = items_by_parent.get(order.name) or []
		transport_rows = items
		if transport_item:
			transport_rows = [row for row in items if row.item_code == transport_item] or items

		transport_customer = order.get("transport_customer") or transport_customer_by_dn.get(
			order.get("custom_delivery_note_to_be_transported")
		)
		zone, zone_source = _resolve_zone(
			get_order_zone(order),
			zones_by_parent.get(order.name),
			transport_customer,
		)

		qty = sum(flt(row.qty) for row in transport_rows)
		current_amount = sum(flt(row.amount) for row in transport_rows)
		rates = {flt(row.rate) for row in transport_rows}
		current_rate = next(iter(rates)) if len(rates) == 1 else None

		zone_amount = zone_amounts.get(zone) if zone else None
		new_rate = zone_amount or None
		new_amount = flt(qty) * new_rate if new_rate else None

		rows.append(
			{
				"name": order.name,
				"customer": order.customer,
				"customer_name": order.get("customer_name") or order.customer,
				"transaction_date": order.get("transaction_date"),
				"currency": order.get("currency"),
				"grand_total": flt(order.get("grand_total")),
				"transport_customer": transport_customer,
				"delivery_note": order.get("custom_delivery_note_to_be_transported"),
				"zone": zone,
				"zone_source": zone_source,
				"qty": qty,
				"current_rate": current_rate,
				"current_amount": current_amount,
				"zone_amount": zone_amount,
				"new_rate": new_rate,
				"new_amount": new_amount,
				"changed": bool(
					new_amount is not None and flt(new_amount) != flt(current_amount)
				),
				"can_update": bool(transport_rows),
				"reason": None if transport_rows else _("No transport charge line found"),
			}
		)

	return {
		"orders": rows,
		"zones": zone_catalog,
		"zone_field": zone_fields[0] if zone_fields else None,
		"transport_item": transport_item,
		"count": len(rows),
	}


@frappe.whitelist()
def get_draft_transport_order_preview(search: str | None = None, limit: int = 200):
	"""Draft transport orders with their zone, current price and zone price."""
	if not frappe.has_permission("Sales Order", "read"):
		frappe.throw(_("You do not have permission to read Sales Orders"), frappe.PermissionError)

	limit = max(1, min(cint(limit) or 200, MAX_ORDERS))
	return _build_preview(search=search, limit=limit)


def _skipped(name: str, reason: str) -> dict:
	return {"name": name, "status": "skipped", "reason": reason}


def sync_transport_order_price(
	name: str,
	zone: str | None = None,
	amount: float | None = None,
	stamp_zone: bool = False,
) -> dict:
	"""Copy an Address Zone amount onto a draft transport order.

	Returns a result dict: ``status`` is either ``updated`` or ``skipped``.
	"""
	if not frappe.db.exists("Sales Order", name):
		return _skipped(name, _("Sales Order not found"))
	if not frappe.has_permission("Sales Order", "write", doc=name):
		return _skipped(name, _("You do not have permission to update this order"))

	doc = frappe.get_doc("Sales Order", name)
	if doc.docstatus != 0:
		return _skipped(name, _("Only draft orders can be updated"))
	if not doc.get("custom_is_transport_order"):
		return _skipped(name, _("This is not a transport order"))

	resolved_zone, _source = resolve_order_zone(doc)
	zone = (zone or "").strip() or resolved_zone
	if not zone:
		return _skipped(name, _("Select a zone for this order"))
	if not frappe.db.exists("Address Zone", zone):
		return _skipped(name, _("Zone {0} was not found").format(zone))

	amount = flt(amount) if amount is not None else get_zone_amount(zone)
	if not amount:
		return _skipped(name, _("Zone {0} has no transport amount").format(zone))

	rows = _get_transport_rows(doc)
	if not rows:
		return _skipped(name, _("No transport charge line found"))

	old_rate = flt(rows[0].rate)
	old_total = flt(doc.grand_total)

	zone_fields = get_zone_fields()
	stamp = bool(zone_fields and stamp_zone and get_order_zone(doc) != zone)
	price_changed = any(
		flt(row.rate) != amount or flt(row.amount) != flt(row.qty) * amount for row in rows
	)
	charge_changed = bool(
		doc.meta.has_field("transport_charge") and flt(doc.get("transport_charge")) != amount
	)

	if not (price_changed or stamp or charge_changed):
		return {
			"name": doc.name,
			"status": "unchanged",
			"zone": zone,
			"old_rate": old_rate,
			"new_rate": amount,
			"old_total": old_total,
			"new_total": old_total,
			"currency": doc.currency,
			"reason": _("Price already matches the zone amount"),
		}

	save_point = "ultrafreight_zone_price_sync"
	frappe.db.savepoint(save_point)
	try:
		for row in rows:
			row.rate = amount
			if row.meta.has_field("price_list_rate"):
				row.price_list_rate = amount
			row.amount = flt(row.qty) * amount

		if zone_fields and (stamp_zone or not get_order_zone(doc)):
			set_order_zone(doc, zone)

		if doc.meta.has_field("transport_charge"):
			doc.set("transport_charge", amount)

		# The zone amount is authoritative here; skip pricing rules.
		doc.flags.ignore_pricing_rule = True
		doc.save(ignore_permissions=True)
	except Exception:
		frappe.db.rollback(save_point=save_point)
		frappe.log_error(
			title="Transport zone price sync failed",
			message=f"Sales Order: {name}\nZone: {zone}\n{frappe.get_traceback()}",
		)
		return _skipped(name, _("Could not update this order — see Error Log"))

	return {
		"name": doc.name,
		"status": "updated",
		"zone": zone,
		"old_rate": old_rate,
		"new_rate": amount,
		"old_total": old_total,
		"new_total": flt(doc.grand_total),
		"currency": doc.currency,
	}


@frappe.whitelist()
def update_transport_order_prices(names=None, zones=None):
	"""Apply Address Zone amounts to the selected draft transport orders."""
	if not frappe.has_permission("Sales Order", "write"):
		frappe.throw(_("You do not have permission to update Sales Orders"), frappe.PermissionError)

	order_names = _parse_names(names)
	if not order_names:
		frappe.throw(_("Select at least one transport order to update"))

	zone_map = _parse_zone_map(zones)

	updated, unchanged, skipped = [], [], []
	for name in order_names:
		result = sync_transport_order_price(name, zone=zone_map.get(name), stamp_zone=True)
		status = result.get("status")
		if status == "updated":
			updated.append(result)
		elif status == "unchanged":
			unchanged.append(result)
		else:
			skipped.append(result)

	return {
		"updated": updated,
		"unchanged": unchanged,
		"skipped": skipped,
		"total_updated": len(updated),
		"total_unchanged": len(unchanged),
		"total_skipped": len(skipped),
	}


def _draft_transport_order_names() -> list[str]:
	return frappe.get_all(
		"Sales Order",
		filters={"docstatus": 0, "custom_is_transport_order": 1},
		pluck="name",
		order_by="modified asc",
		limit=0,
	)


def _require_bulk_zone_price_sync():
	if frappe.session.user != "Administrator" and "System Manager" not in frappe.get_roles():
		frappe.throw(
			_("Only System Manager or Administrator can update draft transport prices from Transport Settings"),
			frappe.PermissionError,
		)
	if not frappe.has_permission("Sales Order", "write"):
		frappe.throw(_("You do not have permission to update Sales Orders"), frappe.PermissionError)


def apply_zone_prices_to_draft_transport_orders() -> dict:
	"""Copy each Address Zone amount onto every draft transport Sales Order."""
	names = _draft_transport_order_names()
	updated, unchanged, skipped = [], [], []

	frappe.flags[SYNC_FLAG] = True
	try:
		total = len(names)
		for index, name in enumerate(names, start=1):
			result = sync_transport_order_price(name)
			status = result.get("status")
			if status == "updated":
				updated.append({"name": result["name"], "zone": result.get("zone")})
			elif status == "unchanged":
				unchanged.append(result["name"])
			else:
				skipped.append({"name": result.get("name") or name, "reason": result.get("reason")})

			if total and index % 10 == 0:
				frappe.publish_progress(
					index / total * 100,
					title=_("Updating draft transport prices"),
					description=_("{0} of {1}").format(index, total),
				)
			if not frappe.flags.in_test and index % 25 == 0:
				frappe.db.commit()
	finally:
		frappe.flags[SYNC_FLAG] = False

	return {
		"total": len(names),
		"total_updated": len(updated),
		"total_unchanged": len(unchanged),
		"total_skipped": len(skipped),
		"updated": updated,
		"skipped": skipped,
	}


@frappe.whitelist()
def sync_all_draft_transport_order_prices():
	"""Re-price every draft transport Sales Order from its Address Zone amount."""
	_require_bulk_zone_price_sync()
	summary = apply_zone_prices_to_draft_transport_orders()

	frappe.msgprint(
		_(
			"Checked {0} draft transport order(s). Updated {1}, already matching {2}, skipped {3}."
		).format(
			summary["total"],
			summary["total_updated"],
			summary["total_unchanged"],
			summary["total_skipped"],
		),
		title=_("Draft Transport Prices"),
		indicator="green" if summary["total_updated"] else "blue",
	)
	return summary


def sync_draft_transport_orders_on_zone_update(doc, method=None):
	"""Address Zone ``on_update`` hook: re-price draft transport orders using the zone."""
	if frappe.flags.get(SYNC_FLAG):
		return 0
	if (
		frappe.flags.in_install
		or frappe.flags.in_migrate
		or frappe.flags.in_patch
		or frappe.flags.in_import
	):
		return 0
	if not doc.has_value_changed("transport_charges"):
		return 0

	amount = flt(doc.transport_charges)
	if not amount:
		return 0

	preview = _build_preview(limit=MAX_ORDERS)
	names = [
		row["name"]
		for row in preview["orders"]
		if row.get("zone") == doc.name and row.get("can_update")
	]
	if not names:
		return 0

	updated = []
	frappe.flags[SYNC_FLAG] = True
	try:
		for name in names:
			result = sync_transport_order_price(name, zone=doc.name, amount=amount)
			if result.get("status") == "updated":
				updated.append(result["name"])
	finally:
		frappe.flags[SYNC_FLAG] = False

	if updated:
		frappe.msgprint(
			_("Draft transport order(s) re-priced to {0} for zone {1}:<br>{2}").format(
				frappe.format(amount, {"fieldtype": "Currency"}),
				doc.name,
				", ".join(frappe.utils.get_link_to_form("Sales Order", name) for name in updated),
			),
			title=_("Zone Prices Updated"),
			indicator="green",
		)

	return len(updated)

