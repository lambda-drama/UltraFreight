import frappe


def get_context(context):
	# Next.js export embeds CSS vars like `__variable_*`.
	# Frappe safe_render rejects any template containing ".__".
	context.safe_render = False
	context.no_cache = 1
	context.csrf_token = frappe.sessions.get_csrf_token()
	return context
