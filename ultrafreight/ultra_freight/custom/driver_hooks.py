import secrets

import frappe
from frappe import _

PIN_LENGTH = 4
PIN_MAX_ATTEMPTS = 50


def generate_driver_pin() -> str:
	"""Generate a unique 4-digit PIN for the driver portal."""
	for _ in range(PIN_MAX_ATTEMPTS):
		pin = f"{secrets.randbelow(10**PIN_LENGTH):0{PIN_LENGTH}d}"
		if not frappe.db.exists("Driver", {"unique_key": pin}):
			return pin
	frappe.throw(_("Could not generate a unique driver PIN. Please try again."))


def ensure_driver_unique_key(doc, method=None):
	if doc.get("unique_key"):
		return
	doc.unique_key = generate_driver_pin()


def validate_driver(doc, method=None):
	key = (doc.get("unique_key") or "").strip()
	if not key:
		return

	# New keys are 4-digit PINs; longer legacy keys remain valid until regenerated
	is_pin = key.isdigit() and len(key) == PIN_LENGTH
	is_legacy = len(key) > PIN_LENGTH
	if not is_pin and not is_legacy:
		frappe.throw(_("Driver PIN must be a {0}-digit number").format(PIN_LENGTH))

	if frappe.db.exists("Driver", {"unique_key": key, "name": ("!=", doc.name)}):
		frappe.throw(_("Driver PIN must be unique"))
