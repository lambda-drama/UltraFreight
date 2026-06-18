app_name = "ultrafreight"
app_title = "Ultra Freight"
app_publisher = "Mania"
app_description = "Transport Logistic"
app_email = "maniajrmania19@gmail.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ["erpnext"]

fixtures = [
	{
		"doctype": "Custom Field",
		"filters": [
			[
				"name",
				"in",
				(
					"Sales Order-transport_dispatch_section",
					"Sales Order-require_direct_delivery",
					"Sales Order-transport_customer",
					"Sales Order-transport_customer_name",
					"Sales Order-transport_phone",
					"Sales Order-transport_email",
					"Sales Order-transport_address",
					"Sales Order-transport_column_break",
					"Sales Order-driver",
					"Sales Order-expected_delivery_date",
					"Sales Order-transport_charge",
					"Delivery Note-transport_dispatch_section",
					"Delivery Note-require_direct_delivery",
					"Delivery Note-transport_customer",
					"Delivery Note-transport_customer_name",
					"Delivery Note-transport_phone",
					"Delivery Note-transport_email",
					"Delivery Note-transport_address",
					"Delivery Note-transport_status_column",
					"Delivery Note-delivery_status",
					"Delivery Note-otp",
					"Delivery Note-otp_generated_at",
					"Delivery Note-otp_expires_at",
					"Delivery Note-confirmation_log",
					"Delivery Note-transport_sales_invoice",
					"Driver-transport_dispatch_section",
					"Driver-unique_key",
					"Driver-vehicle_number",
					"Driver-transport_company",
				),
			]
		],
	},
]

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "ultrafreight",
		"title": "Ultra Freight",
		"route": "/desk/ultra-dispatch",
		"has_permission": "ultrafreight.ultra_freight.api.permission.has_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/ultrafreight/css/ultrafreight.css"
# app_include_js = "/assets/ultrafreight/js/ultrafreight.js"

# include js, css files in header of web template
# web_include_css = "/assets/ultrafreight/css/ultrafreight.css"
# web_include_js = "/assets/ultrafreight/js/ultrafreight.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "ultrafreight/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Sales Order": "public/js/sales_order.js",
	"Delivery Note": "public/js/delivery_note.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "ultrafreight/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "ultrafreight.utils.jinja_methods",
# 	"filters": "ultrafreight.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "ultrafreight.install.before_install"
# after_install = "ultrafreight.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "ultrafreight.uninstall.before_uninstall"
# after_uninstall = "ultrafreight.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "ultrafreight.utils.before_app_install"
# after_app_install = "ultrafreight.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "ultrafreight.utils.before_app_uninstall"
# after_app_uninstall = "ultrafreight.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "ultrafreight.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Driver": {
		"before_insert": "ultrafreight.ultra_freight.custom.driver_hooks.ensure_driver_unique_key",
		"before_save": "ultrafreight.ultra_freight.custom.driver_hooks.ensure_driver_unique_key",
		"validate": "ultrafreight.ultra_freight.custom.driver_hooks.validate_driver",
	},
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"ultrafreight.tasks.all"
# 	],
# 	"daily": [
# 		"ultrafreight.tasks.daily"
# 	],
# 	"hourly": [
# 		"ultrafreight.tasks.hourly"
# 	],
# 	"weekly": [
# 		"ultrafreight.tasks.weekly"
# 	],
# 	"monthly": [
# 		"ultrafreight.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "ultrafreight.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
override_doctype_class = {
	"Sales Order": "ultrafreight.ultra_freight.overrides.sales_order.UltraFreightSalesOrder",
	"Delivery Note": "ultrafreight.ultra_freight.overrides.delivery_note.UltraFreightDeliveryNote",
}

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "ultrafreight.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "ultrafreight.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["ultrafreight.utils.before_request"]
# after_request = ["ultrafreight.utils.after_request"]

# Job Events
# ----------
# before_job = ["ultrafreight.utils.before_job"]
# after_job = ["ultrafreight.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"ultrafreight.auth.validate"
# ]

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

