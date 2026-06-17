import frappe


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
			"ultra_transport_company",
			"default_transport_item",
			"default_sales_taxes_template",
			"default_transport_charges",
			"ultra_transport_email",
			"driver_portal_url",
		],
		as_dict=True,
	) or {}
