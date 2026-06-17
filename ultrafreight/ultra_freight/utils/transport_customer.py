import frappe
from frappe import _


def find_or_create_transport_customer(
	customer_name: str,
	phone_number: str,
	email: str | None = None,
	delivery_address: str | None = None,
	city: str | None = None,
	state: str | None = None,
	postal_code: str | None = None,
	country: str | None = None,
) -> str:
	phone_number = (phone_number or "").strip()
	email = (email or "").strip()

	if not customer_name or not phone_number:
		frappe.throw(_("Transport Customer Name and Phone are required for direct delivery"))

	filters = {"phone_number": phone_number}
	if email:
		existing = frappe.db.get_value("Transport Customer", {"email": email}, "name")
		if existing:
			_update_transport_customer(
				existing,
				customer_name,
				phone_number,
				email,
				delivery_address,
				city,
				state,
				postal_code,
				country,
			)
			return existing

	existing = frappe.db.get_value("Transport Customer", filters, "name")
	if existing:
		_update_transport_customer(
			existing,
			customer_name,
			phone_number,
			email,
			delivery_address,
			city,
			state,
			postal_code,
			country,
		)
		return existing

	doc = frappe.get_doc(
		{
			"doctype": "Transport Customer",
			"customer_name": customer_name,
			"phone_number": phone_number,
			"email": email,
			"delivery_address": delivery_address,
			"city": city,
			"state": state,
			"postal_code": postal_code,
			"country": country,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _update_transport_customer(
	name,
	customer_name,
	phone_number,
	email,
	delivery_address,
	city,
	state,
	postal_code,
	country,
):
	doc = frappe.get_doc("Transport Customer", name)
	doc.customer_name = customer_name
	doc.phone_number = phone_number
	if email:
		doc.email = email
	if delivery_address:
		doc.delivery_address = delivery_address
	if city:
		doc.city = city
	if state:
		doc.state = state
	if postal_code:
		doc.postal_code = postal_code
	if country:
		doc.country = country
	doc.save(ignore_permissions=True)


def sync_transport_customer_fields(doc):
	if not doc.get("transport_customer"):
		return
	tc = frappe.get_cached_doc("Transport Customer", doc.transport_customer)
	doc.transport_customer_name = tc.customer_name
	doc.transport_phone = tc.phone_number
	doc.transport_email = tc.email
	doc.transport_address = tc.delivery_address
