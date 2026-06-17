import frappe


def has_app_permission():
	"""Allow all logged-in desk users to access Ultra Freight workspace."""
	return frappe.session.user != "Guest"
