"""Resolve the Sales Order field that stores the Address Zone.

The app's custom field fixtures define ``custom_address_zone``, while older
sites (and sites customised through *Customize Form*) only have ``custom_zone_``.
Reading or writing the wrong one silently drops the zone — the transport portal
saved the zone into a field that did not exist and then asked for it again on
approve.

Every code path that touches the zone of a transport order must use these
helpers:

* :func:`get_zone_fields` — the zone link fields this site actually has;
* :func:`get_order_zone` — read the zone, whichever field holds it;
* :func:`get_zone_values` / :func:`set_order_zone` — stamp the zone into every
  field the site has, so Desk forms and the portal always agree;
* :func:`normalize_order_zone_fields` — ``Sales Order`` validate hook that keeps
  both fields in step on sites where both are installed.
"""

from __future__ import annotations

import frappe

# Sales Order link fields that may store the Address Zone, in priority order.
ZONE_FIELD_CANDIDATES = ("custom_address_zone", "custom_zone_")


def _has_column(doctype: str, fieldname: str) -> bool:
	"""True when the field exists both in the doctype meta and as a DB column."""
	cache = getattr(frappe.local, "_ultrafreight_zone_field_columns", None)
	if cache is None:
		cache = {}
		frappe.local._ultrafreight_zone_field_columns = cache

	key = (doctype, fieldname)
	if key not in cache:
		try:
			cache[key] = bool(frappe.db.has_column(doctype, fieldname))
		except Exception:
			cache[key] = False
	return cache[key]


def get_zone_fields(doctype: str = "Sales Order") -> list[str]:
	"""Address Zone link fields installed on ``doctype``, in priority order."""
	meta = frappe.get_meta(doctype)
	return [
		fieldname
		for fieldname in ZONE_FIELD_CANDIDATES
		if meta.has_field(fieldname) and _has_column(doctype, fieldname)
	]


def get_zone_fieldname(doctype: str = "Sales Order") -> str | None:
	"""Preferred Address Zone field name (kept for callers needing one field)."""
	fields = get_zone_fields(doctype)
	return fields[0] if fields else None


def get_order_zone(order, doctype: str = "Sales Order") -> str | None:
	"""Zone stored on a Sales Order document or dict, whichever field holds it."""
	for fieldname in get_zone_fields(doctype):
		value = order.get(fieldname)
		if value:
			return value
	return None


def get_zone_values(zone: str | None, doctype: str = "Sales Order") -> dict[str, str | None]:
	"""``frappe.db.set_value`` payload that stamps ``zone`` into every zone field."""
	return {fieldname: zone for fieldname in get_zone_fields(doctype)}


def set_order_zone(order, zone: str | None, doctype: str = "Sales Order") -> list[str]:
	"""Write ``zone`` into every zone field of a document and return the field names."""
	fields = get_zone_fields(doctype)
	for fieldname in fields:
		order.set(fieldname, zone)
	return fields


def normalize_order_zone_fields(doc, method=None):
	"""``Sales Order`` validate hook: keep duplicate zone fields in sync.

	Sites that installed ``custom_address_zone`` on top of a legacy ``custom_zone_``
	would otherwise show one field filled and the other stale, so the portal and
	the Desk form could disagree about the zone of the same order.
	"""
	fields = get_zone_fields(doc.doctype)
	if len(fields) < 2:
		return

	changed = [fieldname for fieldname in fields if doc.has_value_changed(fieldname)]
	if changed:
		zone = doc.get(changed[0])
	else:
		zone = get_order_zone(doc, doc.doctype)

	for fieldname in fields:
		doc.set(fieldname, zone)
