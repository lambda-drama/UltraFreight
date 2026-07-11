import frappe
from frappe import _
from frappe.utils import add_to_date, flt, format_datetime, get_url, now_datetime

from erpnext.controllers.accounts_controller import get_taxes_and_charges
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

from ultrafreight.ultra_freight.api.notifications import create_confirmation_log, notify_on_the_way
from ultrafreight.ultra_freight.utils.otp_generator import generate_otp, get_otp_expiry_minutes
from ultrafreight.ultra_freight.utils.sms_handler import send_transport_sms
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


def get_main_company_invoice_for_delivery_note(delivery_note_name: str) -> dict | None:
	"""Return the latest submitted Sales Invoice created from this Delivery Note (goods invoice)."""
	if not delivery_note_name:
		return None

	rows = frappe.db.sql(
		"""
		SELECT si.name, si.posting_date
		FROM `tabSales Invoice` si
		INNER JOIN `tabSales Invoice Item` sii ON sii.parent = si.name
		WHERE sii.delivery_note = %s
			AND si.docstatus = 1
			AND IFNULL(si.is_return, 0) = 0
		GROUP BY si.name
		ORDER BY si.posting_date DESC, si.creation DESC
		LIMIT 1
		""",
		delivery_note_name,
		as_dict=True,
	)
	return rows[0] if rows else None


def sync_main_company_invoice_to_transport_order(delivery_note_name: str, invoice_name: str | None = None):
	"""Set Main Company Invoice on the draft/submitted transport SO linked to this DN."""
	if not delivery_note_name:
		return

	invoice = None
	if invoice_name:
		posting_date = frappe.db.get_value("Sales Invoice", invoice_name, "posting_date")
		if posting_date:
			invoice = {"name": invoice_name, "posting_date": posting_date}
	else:
		invoice = get_main_company_invoice_for_delivery_note(delivery_note_name)

	if not invoice:
		return

	transport_so = frappe.db.get_value("Delivery Note", delivery_note_name, "transport_sales_order")
	if not transport_so:
		transport_so = frappe.db.get_value(
			"Sales Order",
			{
				"custom_is_transport_order": 1,
				"custom_delivery_note_to_be_transported": delivery_note_name,
			},
			"name",
		)
	if not transport_so:
		return

	frappe.db.set_value(
		"Sales Order",
		transport_so,
		{
			"custom_main_company_invoice": invoice["name"],
			"custom_main_company_invoice_date": invoice["posting_date"],
		},
		update_modified=False,
	)


def create_transport_sales_order(delivery_note_name: str) -> str:
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()

	_ensure_transport_fields_installed()

	original_goods_order = _get_linked_sales_order(doc)
	existing_transport_order = doc.get("transport_sales_order")

	if existing_transport_order:
		if _is_valid_transport_sales_order(existing_transport_order, original_goods_order, doc.name):
			return existing_transport_order
		frappe.db.set_value(
			"Delivery Note", doc.name, "transport_sales_order", None, update_modified=False
		)

	company = settings.get("ultra_transport_company")
	transport_item = settings.get("default_transport_item")
	if not company:
		frappe.throw(_("Set Ultra Transport Company in Transport Settings"))
	if not transport_item:
		frappe.throw(_("Set Default Transport Service Item in Transport Settings"))
	if not doc.customer:
		frappe.throw(_("Delivery Note customer is required to create transport sales order"))

	transport_charge = _resolve_transport_charge(original_goods_order, settings)
	taxes_and_charges = settings.get("default_sales_taxes_template")

	so = frappe.new_doc("Sales Order")
	so.company = company
	so.customer = doc.customer
	so.transaction_date = frappe.utils.today()
	so.delivery_date = frappe.utils.today()
	so.currency = frappe.db.get_value("Company", company, "default_currency")
	so.conversion_rate = 1
	so.taxes_and_charges = taxes_and_charges

	_append_transport_service_item(so, transport_item, transport_charge, doc.name, original_goods_order)

	if taxes_and_charges:
		for tax in get_taxes_and_charges("Sales Taxes and Charges Template", taxes_and_charges):
			so.append("taxes", tax)

	so.flags.creating_transport_sales_order = True
	so.flags.ignore_pricing_rule = True
	so.run_method("calculate_taxes_and_totals")
	so.insert(ignore_permissions=True)

	if original_goods_order and so.name == original_goods_order:
		frappe.throw(
			_(
				"Transport Sales Order must be a new document under {0}. "
				"It cannot reuse the goods Sales Order {1}."
			).format(company, original_goods_order)
		)

	so_values = {
		"custom_is_transport_order": 1,
		"custom_delivery_note_to_be_transported": doc.name,
	}
	main_invoice = get_main_company_invoice_for_delivery_note(doc.name)
	if main_invoice:
		so_values["custom_main_company_invoice"] = main_invoice["name"]
		so_values["custom_main_company_invoice_date"] = main_invoice["posting_date"]

	frappe.db.set_value(
		"Sales Order",
		so.name,
		so_values,
		update_modified=False,
	)

	frappe.db.set_value(
		"Delivery Note",
		doc.name,
		{
			"transport_sales_order": so.name,
			"delivery_status": "Open",
		},
		update_modified=False,
	)

	sales_order = _get_linked_sales_order(doc)
	create_confirmation_log(
		delivery_note_name=doc.name,
		sales_order_name=sales_order,
		driver_name=doc.get("driver"),
		transport_customer=doc.get("transport_customer"),
		status="Open",
	)
	return so.name


def _is_valid_transport_sales_order(
	transport_order_name: str, goods_order_name: str | None, delivery_note_name: str
) -> bool:
	if goods_order_name and transport_order_name == goods_order_name:
		return False

	values = frappe.db.get_value(
		"Sales Order",
		transport_order_name,
		["custom_is_transport_order", "custom_delivery_note_to_be_transported", "docstatus"],
		as_dict=True,
	)
	if not values or not values.custom_is_transport_order:
		return False
	if values.custom_delivery_note_to_be_transported != delivery_note_name:
		return False
	return True


def notify_transport_company_pending_dispatch(delivery_note_name: str, transport_sales_order: str):
	frappe.enqueue(
		"ultrafreight.ultra_freight.api.transport_dispatch._send_transport_company_pending_dispatch",
		queue="short",
		delivery_note_name=delivery_note_name,
		transport_sales_order=transport_sales_order,
		now=frappe.in_test,
	)


def _send_transport_company_pending_dispatch(delivery_note_name: str, transport_sales_order: str):
	try:
		doc = frappe.get_doc("Delivery Note", delivery_note_name)
		settings = get_transport_settings()
		email = settings.get("ultra_transport_email")
		subject = _("Transport request - Delivery Note {0}").format(doc.name)
		message = format_delivery_note_email(
			doc,
			_(
				"A delivery note requires transport. A <strong>draft</strong> Sales Order "
				"<strong>{0}</strong> has been created. Please review and update the "
				"quantity or amount if needed, then submit it to initiate dispatch."
			).format(transport_sales_order),
		)

		if email:
			send_transport_email([email], subject, message, "Delivery Note", doc.name)

		sms_message = _(
			"Draft transport SO {0} created for DN {1}. Review amount/qty, then submit to initiate dispatch."
		).format(transport_sales_order, doc.name)
		phone = _get_company_phone(settings.get("ultra_transport_company"))
		if phone:
			send_transport_sms(
				[phone],
				sms_message,
				delivery_note=doc.name,
				party="Transport Company",
				event="Draft Transport Order",
				recipient_label=settings.get("ultra_transport_company"),
			)
	except Exception:
		frappe.log_error(
			title=_("Ultra Dispatch Notification Failed"),
			message=frappe.get_traceback(),
		)


def initiate_transport_on_sales_order_submit(sales_order_name: str):
	so = frappe.get_doc("Sales Order", sales_order_name)
	if not so.get("custom_is_transport_order"):
		return
	if not so.get("custom_delivery_note_to_be_transported"):
		frappe.throw(_("Delivery Note To Be Transported is required for transport orders"))

	dn_name = so.custom_delivery_note_to_be_transported
	dn = frappe.get_doc("Delivery Note", dn_name)

	if dn.docstatus != 1:
		frappe.throw(_("Linked Delivery Note {0} must be submitted").format(dn_name))

	otp = setup_delivery_note_otp(dn_name)

	try:
		notify_transport_initiated(dn_name, sales_order_name, otp)
		notify_on_the_way(dn_name)
	except Exception:
		frappe.log_error(
			title=_("Ultra Dispatch Notification Failed"),
			message=frappe.get_traceback(),
		)

	create_confirmation_log(
		delivery_note_name=dn_name,
		sales_order_name=sales_order_name,
		driver_name=dn.get("driver"),
		transport_customer=dn.get("transport_customer"),
		otp=otp,
		status="In Transit",
	)

	frappe.db.set_value(
		"Delivery Note",
		dn_name,
		{"delivery_status": "In Transit"},
		update_modified=False,
	)


def create_transport_sales_invoice_from_order(transport_sales_order_name: str) -> str:
	so = frappe.get_doc("Sales Order", transport_sales_order_name)
	settings = get_transport_settings()
	transport_item = settings.get("default_transport_item")
	dn_name = so.custom_delivery_note_to_be_transported

	if not transport_item:
		frappe.throw(_("Set Default Transport Service Item in Transport Settings"))

	_validate_transport_order_items(so, transport_item)

	existing_invoice = frappe.db.get_value("Delivery Note", dn_name, "transport_sales_invoice")
	if existing_invoice:
		return existing_invoice

	si = make_sales_invoice(transport_sales_order_name)
	_validate_transport_order_items(si, transport_item)
	si.insert(ignore_permissions=True)
	si.submit()
	return si.name


def setup_delivery_note_otp(delivery_note_name: str) -> str:
	otp = generate_otp()
	generated_at = now_datetime()
	expiry_minutes = get_otp_expiry_minutes()
	expires_at = add_to_date(generated_at, minutes=expiry_minutes)

	frappe.db.set_value(
		"Delivery Note",
		delivery_note_name,
		{
			"otp": otp,
			"otp_generated_at": generated_at,
			"otp_expires_at": expires_at,
		},
		update_modified=False,
	)
	return otp


def notify_transport_initiated(delivery_note_name: str, transport_sales_order_name: str, otp: str):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()
	portal_path = settings.get("driver_portal_url") or "/driver"
	portal_link = get_url(portal_path)

	sms_message = _("Transport initiated for DN {0}. OTP: {1}. Driver portal: {2}").format(
		doc.name, otp, portal_link
	)

	recipients = []
	if company_phone := _get_company_phone(settings.get("ultra_transport_company")):
		recipients.append(
			(company_phone, "Transport Company", settings.get("ultra_transport_company"))
		)
	if doc.get("transport_phone"):
		recipients.append(
			(doc.transport_phone, "Transport Customer", doc.get("transport_customer_name"))
		)
	if customer_phone := frappe.db.get_value("Customer", doc.customer, "mobile_no"):
		recipients.append((customer_phone, "Goods Customer", doc.customer))
	if doc.driver:
		if driver_phone := frappe.db.get_value("Driver", doc.driver, "cell_number"):
			driver_name = frappe.db.get_value("Driver", doc.driver, "full_name")
			recipients.append((driver_phone, "Driver", driver_name))
		if driver_company := frappe.db.get_value("Driver", doc.driver, "transport_company"):
			if company_phone := _get_company_phone(driver_company):
				recipients.append((company_phone, "Transport Company", driver_company))

	for phone, party, label in recipients:
		send_transport_sms(
			[phone],
			sms_message,
			delivery_note=doc.name,
			party=party,
			event="Transport Initiated",
			recipient_label=label,
		)

	email_recipients = set()
	if settings.get("ultra_transport_email"):
		email_recipients.add(settings.ultra_transport_email)
	if doc.get("transport_email"):
		email_recipients.add(doc.transport_email)
	if customer_email := frappe.db.get_value("Customer", doc.customer, "email_id"):
		email_recipients.add(customer_email)

	email_body = format_delivery_note_email(
		doc,
		_(
			"Transport charge Sales Order <strong>{0}</strong> has been submitted. "
			"Dispatch is now active.<br>OTP: <strong>{1}</strong><br>"
			"Driver portal: <a href='{2}'>{2}</a>"
		).format(transport_sales_order_name, otp, portal_link),
	)
	for email in email_recipients:
		send_transport_email(
			[email],
			_("Transport Initiated - {0}").format(doc.name),
			email_body,
			"Delivery Note",
			doc.name,
		)


def _get_linked_sales_order(doc) -> str | None:
	for item in doc.items:
		if item.against_sales_order:
			return item.against_sales_order
	return None


def _append_transport_service_item(
	doc,
	transport_item: str,
	transport_charge: float,
	delivery_note_name: str,
	goods_order_name: str | None = None,
):
	item_details = frappe.get_cached_value(
		"Item",
		transport_item,
		["item_name", "stock_uom", "description"],
		as_dict=True,
	)
	if not item_details:
		frappe.throw(_("Transport service item {0} was not found").format(transport_item))

	description = _("Transport charge for Delivery Note {0}").format(delivery_note_name)
	if goods_order_name:
		description = _("Transport charge for Delivery Note {0} (Goods Order: {1})").format(
			delivery_note_name, goods_order_name
		)

	doc.append(
		"items",
		{
			"item_code": transport_item,
			"item_name": item_details.item_name,
			"description": description,
			"qty": 1,
			"rate": transport_charge,
			"uom": item_details.stock_uom,
			"delivery_date": frappe.utils.today(),
		},
	)


def _validate_transport_order_items(doc, transport_item: str):
	invalid_items = [row.item_code for row in doc.items if row.item_code != transport_item]
	if invalid_items:
		frappe.throw(
			_(
				"Transport orders must only include the transport service item ({0}). "
				"Found other items: {1}"
			).format(transport_item, ", ".join(invalid_items))
		)


validate_transport_order_items = _validate_transport_order_items


def _resolve_transport_charge(goods_sales_order_name: str | None, settings: dict) -> float:
	transport_charge = flt(settings.get("default_transport_charges"))
	if goods_sales_order_name:
		order_charge = flt(frappe.db.get_value("Sales Order", goods_sales_order_name, "transport_charge"))
		if order_charge:
			transport_charge = order_charge
	return transport_charge


def _get_company_phone(company: str | None) -> str | None:
	if not company:
		return None
	return frappe.db.get_value("Company", company, "phone_no")


def _ensure_transport_fields_installed():
	so_meta = frappe.get_meta("Sales Order")
	dn_meta = frappe.get_meta("Delivery Note")
	missing = []
	if not so_meta.has_field("custom_is_transport_order"):
		missing.append("Sales Order.custom_is_transport_order")
	if not so_meta.has_field("custom_delivery_note_to_be_transported"):
		missing.append("Sales Order.custom_delivery_note_to_be_transported")
	if not dn_meta.has_field("transport_sales_order"):
		missing.append("Delivery Note.transport_sales_order")
	if missing:
		frappe.throw(
			_("Missing Ultra Freight fields: {0}. Please run bench migrate on this site.").format(
				", ".join(missing)
			)
		)
