import frappe

from ultrafreight.ultra_freight.utils.delivery_status import (
	LEGACY_DELIVERY_STATUS,
	delivery_status_field_options,
)


def execute():
	for legacy, target in LEGACY_DELIVERY_STATUS.items():
		frappe.db.sql(
			"""
			UPDATE `tabDelivery Note`
			SET delivery_status = %s
			WHERE delivery_status = %s
			""",
			(target, legacy),
		)

	frappe.db.sql(
		"""
		UPDATE `tabDelivery Note`
		SET delivery_status = 'Open'
		WHERE delivery_status IS NULL OR delivery_status = ''
		"""
	)

	frappe.db.sql(
		"""
		UPDATE `tabDelivery Confirmation Log`
		SET status = 'Completed'
		WHERE status = 'Partially Delivered'
		"""
	)

	if frappe.db.exists("Custom Field", "Delivery Note-delivery_status"):
		frappe.db.set_value(
			"Custom Field",
			"Delivery Note-delivery_status",
			{
				"options": delivery_status_field_options(),
				"in_list_view": 1,
				"in_standard_filter": 1,
			},
		)

	frappe.db.commit()
	frappe.clear_cache(doctype="Delivery Note")
	frappe.clear_cache(doctype="Custom Field")
