import frappe

# Fixed public path for the Next.js driver portal (www/driver)
DRIVER_PORTAL_PATH = "/driver"


def get_driver_portal_url(query: str | None = None) -> str:
	"""Absolute URL to the driver portal, optionally with query string."""
	from frappe.utils import get_url

	path = DRIVER_PORTAL_PATH
	if query:
		query = query.lstrip("?")
		path = f"{path}?{query}"
	return get_url(path)


def get_transport_settings() -> dict:
	return frappe.get_cached_value(
		"Transport Settings",
		"Transport Settings",
		[
			"otp_expiry_minutes",
			"sms_provider",
			"sms_api_key",
			"sms_sender_id",
			"sms_api_url",
			"default_country_code",
			"enable_sms",
			"enable_email",
			"ultra_transport_company",
			"default_transport_item",
			"default_sales_taxes_template",
			"default_transport_charges",
			"ultra_transport_email",
			"branch",
			"cost_center",
			"default_print_format",
			"default_letter_head",
			"create_transport_order_on_dnote_submission",
			"delivery_note_workflow_action_to_create_order",
		],
		as_dict=True,
	) or {}
