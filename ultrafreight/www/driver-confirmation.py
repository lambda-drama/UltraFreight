import frappe

no_cache = 1


def get_context(context):
	context.no_cache = 1

	# Preserve driver/key query params from legacy SMS links
	query = frappe.local.request.query_string
	if isinstance(query, bytes):
		query = query.decode("utf-8", errors="ignore")
	query = (query or "").strip()
	location = f"/driver?{query}" if query else "/driver"

	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = location
	return context
