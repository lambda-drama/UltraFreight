import frappe

no_cache = 1


def get_context(context):
	context.no_cache = 1
	context.no_header = 1
	context.full_width = 1
	context.title = frappe._("Ultra Dispatch")
