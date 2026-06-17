import secrets

import frappe
from frappe import _


def ensure_driver_unique_key(doc, method=None):
	if doc.get("unique_key"):
		return
	doc.unique_key = secrets.token_hex(8)


def validate_driver(doc, method=None):
	if doc.get("unique_key") and frappe.db.exists(
		"Driver", {"unique_key": doc.unique_key, "name": ("!=", doc.name)}
	):
		frappe.throw(_("Unique Key must be unique"))
