import frappe


REMOVED_SO_FIELDS = (
	"Sales Order-transporter",
	"Sales Order-transporter_type",
	"Sales Order-transport_company",
)


def execute():
	for name in REMOVED_SO_FIELDS:
		if frappe.db.exists("Custom Field", name):
			frappe.delete_doc("Custom Field", name, force=1, ignore_permissions=True)

	frappe.clear_cache(doctype="Sales Order")
