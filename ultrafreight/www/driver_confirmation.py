"""Legacy /driver-confirmation -> Driver Portal (/driver).

Kept as a real page (html + controller) instead of a `website_redirects` hook so
that legacy SMS links survive with their query string intact on both Frappe v15
and v16 (v15 ignores `forward_query_parameters`).
"""

import frappe

no_cache = 1


def get_context(context):
	context.no_cache = 1
	context.title = "Driver Portal"

	# Preserve driver/key query params from legacy SMS links
	request = getattr(frappe.local, "request", None)
	query = getattr(request, "query_string", "") if request else ""
	if isinstance(query, bytes):
		query = query.decode("utf-8", errors="ignore")
	query = (query or "").strip()

	location = f"/driver?{query}" if query else "/driver"

	# RedirectPage reads `frappe.flags.redirect_location` (v15 & v16), fall back to
	# `frappe.local.response.location` for older releases.
	frappe.flags.redirect_location = location
	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = location
	raise frappe.Redirect
