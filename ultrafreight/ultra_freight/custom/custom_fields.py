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
			"insert_after": "transport_email",
		},
		{
			"fieldname": "transport_column_break",
			"fieldtype": "Column Break",
			"insert_after": "transport_address",
		},
		{
			"fieldname": "driver",
			"fieldtype": "Link",
			"label": "Driver",
			"options": "Driver",
			"insert_after": "transport_column_break",
		},
		{
			"fieldname": "expected_delivery_date",
			"fieldtype": "Date",
			"label": "Expected Delivery Date",
			"insert_after": "driver",
		},
		{
			"fieldname": "transport_charge",
			"fieldtype": "Currency",
			"label": "Transport Charge",
			"insert_after": "expected_delivery_date",
		},
		{
			"fieldname": "transport_charge_order_section",
			"fieldtype": "Section Break",
			"label": "Transport Charge Order",
			"collapsible": 1,
			"insert_after": "transport_charge",
		},
		{
			"fieldname": "custom_is_transport_order",
			"fieldtype": "Check",
			"label": "Is Transport Order",
			"read_only": 1,
			"insert_after": "transport_charge_order_section",
		},
		{
			"fieldname": "custom_delivery_note_to_be_transported",
			"fieldtype": "Link",
			"label": "Delivery Note To Be Transported",
			"options": "Delivery Note",
			"read_only": 1,
			"insert_after": "custom_is_transport_order",
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
			"options": "\nOpen\nIn Transit\nCompleted",
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
			"fieldname": "transport_sales_order",
			"fieldtype": "Link",
			"label": "Transport Sales Order",
			"options": "Sales Order",
			"read_only": 1,
			"insert_after": "confirmation_log",
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
			"label": "Unique Key",
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

