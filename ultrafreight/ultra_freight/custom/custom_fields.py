def get_sales_order_fields():
	return [
		{
			"fieldname": "transport_dispatch_section",
			"fieldtype": "Section Break",
			"label": "Transport Dispatch",
			"collapsible": 1,
			"insert_after": "items",
		},
		{
			"fieldname": "require_direct_delivery",
			"fieldtype": "Check",
			"label": "Require Direct Delivery",
			"insert_after": "transport_dispatch_section",
		},
		{
			"fieldname": "transport_customer",
			"fieldtype": "Link",
			"label": "Transport Customer",
			"options": "Transport Customer",
			"insert_after": "require_direct_delivery",
		},
		{
			"fieldname": "transport_customer_name",
			"fieldtype": "Data",
			"label": "Transport Customer Name",
			"insert_after": "transport_customer",
		},
		{
			"fieldname": "transport_phone",
			"fieldtype": "Data",
			"label": "Transport Phone",
			"insert_after": "transport_customer_name",
		},
		{
			"fieldname": "transport_email",
			"fieldtype": "Data",
			"label": "Transport Email",
			"insert_after": "transport_phone",
		},
		{
			"fieldname": "transport_address",
			"fieldtype": "Text",
			"label": "Transport Address",
			"insert_after": "driver",
		},
		{
			"fieldname": "custom_final_customer_feedback_document",
			"fieldtype": "Attach",
			"label": "Final Customer Feedback Document",
			"insert_after": "transport_email",
			"allow_on_submit": 1,
		},
		{
			"fieldname": "custom_note",
			"fieldtype": "Small Text",
			"label": "Note",
			"insert_after": "custom_final_customer_feedback_document",
			"allow_on_submit": 1,
		},
		{
			"fieldname": "transport_dispatch_column",
			"fieldtype": "Column Break",
			"insert_after": "custom_note",
		},
		{
			"fieldname": "expected_delivery_date",
			"fieldtype": "Date",
			"label": "Expected Delivery Date",
			"insert_after": "transport_dispatch_column",
		},
		{
			"fieldname": "driver",
			"fieldtype": "Link",
			"label": "Driver",
			"options": "Driver",
			"insert_after": "expected_delivery_date",
		},
		{
			"fieldname": "custom_reschedule_transport_order",
			"fieldtype": "Check",
			"label": "Reschedule Transport Order",
			"insert_after": "transport_address",
		},
		{
			"fieldname": "custom_reason_for_reschedule",
			"fieldtype": "Small Text",
			"label": "Reason for Reschedule",
			"insert_after": "custom_reschedule_transport_order",
			"depends_on": "eval:doc.custom_reschedule_transport_order",
		},
		{
			"fieldname": "transport_charge_order_section",
			"fieldtype": "Section Break",
			"label": "Final Invoice Details",
			"collapsible": 1,
			"insert_after": "custom_reason_for_reschedule",
		},
		{
			"fieldname": "custom_main_company_invoice",
			"fieldtype": "Data",
			"label": "Main Company Invoice",
			"insert_after": "transport_charge_order_section",
			"read_only": 1,
		},
		{
			"fieldname": "custom_main_company_invoice_date",
			"fieldtype": "Date",
			"label": "Main Company Invoice Date",
			"insert_after": "custom_main_company_invoice",
			"read_only": 1,
		},
		{
			"fieldname": "custom_last_customer_invoice",
			"fieldtype": "Data",
			"label": "Last Customer Invoice",
			"insert_after": "custom_main_company_invoice_date",
		},
		{
			"fieldname": "custom_completed_without_otp",
			"fieldtype": "Check",
			"label": "Completed Without OTP",
			"read_only": 1,
			"allow_on_submit": 1,
			"insert_after": "custom_last_customer_invoice",
		},
		{
			"fieldname": "transport_column_break",
			"fieldtype": "Column Break",
			"insert_after": "custom_completed_without_otp",
		},
		{
			"fieldname": "custom_last_customer_invoice_date",
			"fieldtype": "Date",
			"label": "Final Customer Invoice Date",
			"insert_after": "transport_column_break",
		},
		{
			"fieldname": "custom_last_customer_delivery_note",
			"fieldtype": "Data",
			"label": "Final Customer Delivery Note",
			"insert_after": "custom_last_customer_invoice_date",
		},
		{
			"fieldname": "custom_last_customer_delivery_note_date",
			"fieldtype": "Date",
			"label": "Final Customer Delivery Note Date",
			"insert_after": "custom_last_customer_delivery_note",
		},
		{
			"fieldname": "custom_section_break_pfwwy",
			"fieldtype": "Section Break",
			"label": "Final Customer Zone",
			"collapsible": 1,
			"insert_after": "custom_last_customer_delivery_note_date",
		},
		{
			"fieldname": "custom_customer_zone",
			"fieldtype": "Table",
			"label": "Customer Zone",
			"options": "Address Zone Detail",
			"insert_after": "custom_section_break_pfwwy",
		},
		{
			"fieldname": "custom_is_transport_order",
			"fieldtype": "Check",
			"label": "Is Transport Order",
			"read_only": 1,
			"insert_after": "order_type",
		},
		{
			"fieldname": "custom_delivery_note_to_be_transported",
			"fieldtype": "Link",
			"label": "Delivery Note To Be Transported",
			"options": "Delivery Note",
			"read_only": 1,
			"insert_after": "custom_customer_zone",
		},
	]


def get_delivery_note_fields():
	return [
		{
			"fieldname": "transport_dispatch_section",
			"fieldtype": "Section Break",
			"label": "Transport Dispatch",
			"collapsible": 1,
			"insert_after": "items",
		},
		{
			"fieldname": "require_direct_delivery",
			"fieldtype": "Check",
			"label": "Require Direct Delivery",
			"read_only": 1,
			"insert_after": "transport_dispatch_section",
		},
		{
			"fieldname": "transport_customer",
			"fieldtype": "Link",
			"label": "Transport Customer",
			"options": "Transport Customer",
			"read_only": 1,
			"insert_after": "require_direct_delivery",
		},
		{
			"fieldname": "transport_customer_name",
			"fieldtype": "Data",
			"label": "Transport Customer Name",
			"read_only": 1,
			"insert_after": "transport_customer",
		},
		{
			"fieldname": "transport_phone",
			"fieldtype": "Data",
			"label": "Transport Phone",
			"read_only": 1,
			"insert_after": "transport_customer_name",
		},
		{
			"fieldname": "transport_email",
			"fieldtype": "Data",
			"label": "Transport Email",
			"read_only": 1,
			"insert_after": "transport_phone",
		},
		{
			"fieldname": "transport_address",
			"fieldtype": "Text",
			"label": "Transport Address",
			"read_only": 1,
			"insert_after": "transport_email",
		},
		{
			"fieldname": "transport_status_column",
			"fieldtype": "Column Break",
			"insert_after": "transport_address",
		},
		{
			"fieldname": "delivery_status",
			"fieldtype": "Select",
			"label": "Delivery Status",
			"options": "\nOpen\nIn Transit\nPending Invoicing\nCompleted",
			"default": "Open",
			"read_only": 1,
			"in_list_view": 1,
			"in_standard_filter": 1,
			"insert_after": "transport_status_column",
		},
		{
			"fieldname": "otp",
			"fieldtype": "Data",
			"label": "OTP",
			"read_only": 1,
			"insert_after": "delivery_status",
		},
		{
			"fieldname": "otp_generated_at",
			"fieldtype": "Datetime",
			"label": "OTP Generated At",
			"read_only": 1,
			"insert_after": "otp",
		},
		{
			"fieldname": "otp_expires_at",
			"fieldtype": "Datetime",
			"label": "OTP Expires At",
			"read_only": 1,
			"insert_after": "otp_generated_at",
		},
		{
			"fieldname": "confirmation_log",
			"fieldtype": "Link",
			"label": "Confirmation Log",
			"options": "Delivery Confirmation Log",
			"read_only": 1,
			"insert_after": "otp_expires_at",
		},
		{
			"fieldname": "sms_status",
			"fieldtype": "Select",
			"label": "SMS Status",
			"options": "\nNot Sent\nPartially Sent\nSent\nFailed",
			"default": "Not Sent",
			"read_only": 1,
			"in_list_view": 1,
			"insert_after": "confirmation_log",
		},
		{
			"fieldname": "email_status",
			"fieldtype": "Select",
			"label": "Email Status",
			"options": "\nNot Sent\nPartially Sent\nSent\nFailed",
			"default": "Not Sent",
			"read_only": 1,
			"in_list_view": 1,
			"insert_after": "sms_status",
		},
		{
			"fieldname": "transport_sales_order",
			"fieldtype": "Link",
			"label": "Transport Sales Order",
			"options": "Sales Order",
			"read_only": 1,
			"insert_after": "email_status",
		},
		{
			"fieldname": "transport_sales_invoice",
			"fieldtype": "Link",
			"label": "Transport Sales Invoice",
			"options": "Sales Invoice",
			"read_only": 1,
			"insert_after": "transport_sales_order",
		},
	]


def get_driver_fields():
	return [
		{
			"fieldname": "transport_dispatch_section",
			"fieldtype": "Section Break",
			"label": "Ultra Dispatch",
			"collapsible": 1,
			"insert_after": "cell_number",
		},
		{
			"fieldname": "unique_key",
			"fieldtype": "Data",
			"label": "PIN",
			"unique": 1,
			"read_only": 1,
			"insert_after": "transport_dispatch_section",
		},
		{
			"fieldname": "vehicle_number",
			"fieldtype": "Data",
			"label": "Vehicle Number",
			"insert_after": "unique_key",
		},
		{
			"fieldname": "transport_company",
			"fieldtype": "Link",
			"label": "Transport Company",
			"options": "Company",
			"insert_after": "vehicle_number",
		},
	]


def get_custom_fields():
	return {
		"Sales Order": get_sales_order_fields(),
		"Delivery Note": get_delivery_note_fields(),
		"Driver": get_driver_fields(),
	}


def ensure_sales_order_field_layout():
	"""Put Sales Order transport fields back in a chain this app owns.

	Migrate imports ``insert_after`` from fixtures. The form is then built from
	that chain. Anchors have to be standard Sales Order fields, or fields this
	app creates. A missing anchor dumps the rest of the chain at the end of the
	form, which is the Connections tab.
	"""
	import frappe
	from frappe.custom.doctype.custom_field.custom_field import create_custom_field

	for field in get_sales_order_fields():
		name = f"Sales Order-{field['fieldname']}"
		insert_after = field.get("insert_after")
		if frappe.db.exists("Custom Field", name):
			if frappe.db.get_value("Custom Field", name, "insert_after") != insert_after:
				frappe.db.set_value(
					"Custom Field",
					name,
					"insert_after",
					insert_after,
					update_modified=False,
				)
		else:
			create_custom_field("Sales Order", field)

	# Keep Transport Charge on the right column when the field already exists.
	if frappe.db.exists("Custom Field", "Sales Order-transport_charge"):
		frappe.db.set_value(
			"Custom Field",
			"Sales Order-transport_charge",
			"insert_after",
			"custom_reason_for_reschedule",
			update_modified=False,
		)

	# Local-only column break. Our transport_dispatch_column replaces it.
	# Leaving both would split the section into three columns.
	if frappe.db.exists("Custom Field", "Sales Order-custom_column_break_xatuh"):
		frappe.delete_doc(
			"Custom Field",
			"Sales Order-custom_column_break_xatuh",
			ignore_permissions=True,
			force=True,
		)

	frappe.clear_cache(doctype="Sales Order")
