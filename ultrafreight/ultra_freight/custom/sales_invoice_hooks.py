import frappe


def sync_main_company_invoice_on_submit(doc, method=None):
	"""When a goods Sales Invoice is submitted from a DN, fill Main Company Invoice on the transport SO."""
	if doc.get("is_return"):
		return

	from ultrafreight.ultra_freight.api.transport_dispatch import sync_main_company_invoice_to_transport_order

	delivery_notes = {row.delivery_note for row in doc.items if row.get("delivery_note")}
	for dn_name in delivery_notes:
		sync_main_company_invoice_to_transport_order(dn_name, invoice_name=doc.name)
