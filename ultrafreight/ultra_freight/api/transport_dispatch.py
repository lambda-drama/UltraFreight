import frappe
from frappe import _
from frappe.utils import add_to_date, cint, flt, format_datetime, now_datetime

from erpnext.controllers.accounts_controller import get_taxes_and_charges
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

from ultrafreight.ultra_freight.api.notifications import (
	create_confirmation_log,
	get_company_email,
	get_customer_email,
	get_driver_display,
	notify_on_the_way,
	notify_transport_company_pending_dispatch_inline,
)
from ultrafreight.ultra_freight.utils.email_handler import build_hardcoded_email, send_transport_email
from ultrafreight.ultra_freight.utils.otp_generator import generate_otp, get_otp_expiry_minutes
from ultrafreight.ultra_freight.utils.sms_handler import send_transport_sms
from ultrafreight.ultra_freight.utils.transport_settings import get_driver_portal_url, get_transport_settings


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

	transport_customer = doc.get("transport_customer")
	default_zone = get_default_zone_for_transport_customer(transport_customer)
	address_zone = default_zone.get("zone") if default_zone else None
	transport_charge = resolve_transport_charge(
		settings=settings,
		address_zone=address_zone,
		transport_customer=transport_customer,
		goods_sales_order_name=original_goods_order,
	)
	taxes_and_charges = settings.get("default_sales_taxes_template")

	so = frappe.new_doc("Sales Order")
	so.company = company
	so.customer = doc.customer
	so.transaction_date = frappe.utils.today()
	so.delivery_date = frappe.utils.today()
	so.currency = frappe.db.get_value("Company", company, "default_currency")
	so.conversion_rate = 1

	_append_transport_service_item(so, transport_item, transport_charge, doc.name, original_goods_order)
	_apply_transport_taxes(so, taxes_and_charges, company)

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
	if address_zone and frappe.get_meta("Sales Order").has_field("custom_address_zone"):
		so_values["custom_address_zone"] = address_zone
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
	if values.docstatus == 2:
		return False
	if values.custom_delivery_note_to_be_transported != delivery_note_name:
		return False
	return True


def notify_transport_company_pending_dispatch(delivery_note_name: str, transport_sales_order: str):
	# Run inline so Email Queue rows are created in the same request (no worker required).
	_send_transport_company_pending_dispatch(delivery_note_name, transport_sales_order)


def _send_transport_company_pending_dispatch(delivery_note_name: str, transport_sales_order: str):
	try:
		notify_transport_company_pending_dispatch_inline(delivery_note_name, transport_sales_order)
	except Exception:
		frappe.log_error(
			title=_("Ultra Dispatch Notification Failed"),
			message=frappe.get_traceback(),
		)


def initiate_transport_on_sales_order_submit(sales_order_name: str, send_otp: int | None = None):
	so = frappe.get_doc("Sales Order", sales_order_name)
	if not so.get("custom_is_transport_order"):
		return
	if not so.get("custom_delivery_note_to_be_transported"):
		frappe.throw(_("Delivery Note To Be Transported is required for transport orders"))

	dn_name = so.custom_delivery_note_to_be_transported
	dn = frappe.get_doc("Delivery Note", dn_name)

	if dn.docstatus != 1:
		frappe.throw(_("Linked Delivery Note {0} must be submitted").format(dn_name))

	if send_otp is None:
		send_otp = frappe.flags.get("ultrafreight_send_otp")
	if send_otp is None:
		send_otp = get_transport_customer_send_otp(dn.get("transport_customer"))
	send_otp = 1 if cint(send_otp) else 0

	otp = None
	if send_otp:
		otp = setup_delivery_note_otp(dn_name)
		try:
			notify_transport_initiated(dn_name, sales_order_name, otp)
			notify_on_the_way(dn_name)
		except Exception:
			frappe.log_error(
				title=_("Ultra Dispatch Notification Failed"),
				message=frappe.get_traceback(),
			)
	else:
		# Clear any leftover OTP when intentionally skipping OTP dispatch
		frappe.db.set_value(
			"Delivery Note",
			dn_name,
			{"otp": None, "otp_generated_at": None, "otp_expires_at": None},
			update_modified=False,
		)
		try:
			notify_transport_initiated(dn_name, sales_order_name, otp="")
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


def get_transport_customer_send_otp(transport_customer: str | None) -> int:
	if not transport_customer:
		return 1
	value = frappe.db.get_value("Transport Customer", transport_customer, "send_otp")
	if value is None:
		return 1
	return 1 if cint(value) else 0


def create_transport_sales_invoice_from_order(transport_sales_order_name: str) -> str:
	from erpnext.stock.doctype.delivery_note.delivery_note import (
		make_sales_invoice as make_sales_invoice_from_dn,
	)

	so = frappe.get_doc("Sales Order", transport_sales_order_name)
	settings = get_transport_settings()
	transport_item = settings.get("default_transport_item")
	goods_dn_name = so.custom_delivery_note_to_be_transported

	if not transport_item:
		frappe.throw(_("Set Default Transport Service Item in Transport Settings"))

	_validate_transport_order_items(so, transport_item)

	existing_invoice = (
		frappe.db.get_value("Delivery Note", goods_dn_name, "transport_sales_invoice") if goods_dn_name else None
	)
	if existing_invoice:
		return existing_invoice

	dn_required = frappe.db.get_single_value("Selling Settings", "dn_required") == "Yes"

	if dn_required:
		transport_dn_name = _get_or_create_transport_delivery_note(transport_sales_order_name, settings)
		si = make_sales_invoice_from_dn(transport_dn_name)
	else:
		si = make_sales_invoice(transport_sales_order_name)

	_validate_transport_order_items(si, transport_item)
	_apply_transport_accounting_dimensions(si, settings)
	si.insert(ignore_permissions=True)
	si.submit()
	return si.name


def _get_or_create_transport_delivery_note(transport_sales_order_name: str, settings: dict | None = None) -> str:
	"""Create (and submit) a Delivery Note against the transport Sales Order when SI requires DN."""
	from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

	existing = frappe.db.sql(
		"""
		SELECT dni.parent
		FROM `tabDelivery Note Item` dni
		INNER JOIN `tabDelivery Note` dn ON dn.name = dni.parent
		WHERE dni.against_sales_order = %s
			AND dn.docstatus = 1
		ORDER BY dn.creation DESC
		LIMIT 1
		""",
		transport_sales_order_name,
	)
	if existing:
		return existing[0][0]

	draft = frappe.db.sql(
		"""
		SELECT dni.parent
		FROM `tabDelivery Note Item` dni
		INNER JOIN `tabDelivery Note` dn ON dn.name = dni.parent
		WHERE dni.against_sales_order = %s
			AND dn.docstatus = 0
		ORDER BY dn.creation DESC
		LIMIT 1
		""",
		transport_sales_order_name,
	)
	if draft:
		dn = frappe.get_doc("Delivery Note", draft[0][0])
	else:
		dn = make_delivery_note(transport_sales_order_name)
		_apply_transport_accounting_dimensions(dn, settings)
		dn.flags.ignore_permissions = True
		dn.insert(ignore_permissions=True)

	if dn.docstatus == 0:
		dn.flags.ignore_permissions = True
		dn.submit()

	return dn.name


def _apply_transport_accounting_dimensions(doc, settings: dict | None = None):
	"""Copy Branch / Cost Center from Transport Settings onto the invoice (and items) when set."""
	settings = settings or get_transport_settings()
	branch = settings.get("branch")
	cost_center = settings.get("cost_center")
	if not branch and not cost_center:
		return

	meta = doc.meta
	if branch and meta.has_field("branch"):
		doc.set("branch", branch)
	if cost_center and meta.has_field("cost_center"):
		doc.set("cost_center", cost_center)

	for item in doc.get("items") or []:
		item_meta = frappe.get_meta(item.doctype)
		if branch and item_meta.has_field("branch"):
			item.set("branch", branch)
		if cost_center and item_meta.has_field("cost_center"):
			item.set("cost_center", cost_center)


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


def regenerate_otp_for_transport_order(sales_order_name: str, notify: bool = True) -> dict:
	"""Regenerate delivery OTP when missing or expired after transport order approval."""
	so = frappe.get_doc("Sales Order", sales_order_name)
	if not so.get("custom_is_transport_order"):
		frappe.throw(_("OTP can only be regenerated for transport sales orders"))
	if so.docstatus != 1:
		frappe.throw(_("Approve the transport order before generating an OTP"))

	dn_name = so.get("custom_delivery_note_to_be_transported")
	if not dn_name:
		frappe.throw(_("Delivery Note To Be Transported is required"))

	dn = frappe.get_doc("Delivery Note", dn_name)
	if dn.docstatus != 1:
		frappe.throw(_("Linked Delivery Note {0} must be submitted").format(dn_name))
	if not dn.get("driver"):
		frappe.throw(_("Assign a driver before regenerating the OTP"))

	status = dn.get("delivery_status") or "Open"
	if status in ("Pending Invoicing", "Completed"):
		frappe.throw(
			_("Cannot regenerate OTP when delivery status is {0}").format(status)
		)

	existing_otp = dn.get("otp")
	expires_at = dn.get("otp_expires_at")
	is_expired = bool(expires_at and now_datetime() > expires_at)

	otp = setup_delivery_note_otp(dn_name)
	new_expires_at = frappe.db.get_value("Delivery Note", dn_name, "otp_expires_at")

	if status != "In Transit":
		frappe.db.set_value(
			"Delivery Note",
			dn_name,
			{"delivery_status": "In Transit"},
			update_modified=False,
		)

	# Keep the latest In Transit confirmation log OTP in sync when present
	latest_log = frappe.db.get_value(
		"Delivery Confirmation Log",
		{"delivery_note": dn_name, "status": "In Transit"},
		"name",
		order_by="confirmation_time desc",
	)
	if latest_log:
		frappe.db.set_value("Delivery Confirmation Log", latest_log, "otp", otp, update_modified=False)
	else:
		create_confirmation_log(
			delivery_note_name=dn_name,
			sales_order_name=sales_order_name,
			driver_name=dn.get("driver"),
			transport_customer=dn.get("transport_customer"),
			otp=otp,
			status="In Transit",
		)

	if notify:
		try:
			notify_transport_initiated(dn_name, sales_order_name, otp)
			notify_on_the_way(dn_name)
		except Exception:
			frappe.log_error(
				title=_("Ultra Dispatch Notification Failed"),
				message=frappe.get_traceback(),
			)

	return {
		"sales_order": sales_order_name,
		"delivery_note": dn_name,
		"otp": otp,
		"otp_expires_at": new_expires_at,
		"was_missing": not bool(existing_otp),
		"was_expired": is_expired,
	}


def notify_transport_initiated(delivery_note_name: str, transport_sales_order_name: str, otp: str):
	"""SMS parties + send the 4 hardcoded initiate emails (logged)."""
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()
	portal_link = get_driver_portal_url()
	driver_name, vehicle_no = get_driver_display(doc)
	otp_display = otp or doc.get("otp") or "—"

	# Emails first — must not be blocked by SMS failures / missing phones
	try:
		_send_transport_initiated_emails(
			doc,
			transport_sales_order_name=transport_sales_order_name,
			otp=otp_display,
			driver_name=driver_name,
			vehicle_no=vehicle_no,
			portal_link=portal_link,
		)
	except Exception:
		frappe.log_error(
			title=_("Ultra Dispatch Initiate Emails Failed"),
			message=frappe.get_traceback(),
		)

	sms_message = _("Transport initiated for DN {0}. OTP: {1}. Driver portal: {2}").format(
		doc.name, otp_display, portal_link
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
			recipients.append((driver_phone, "Driver", driver_name or doc.driver))
		if driver_company := frappe.db.get_value("Driver", doc.driver, "transport_company"):
			if company_phone := _get_company_phone(driver_company):
				recipients.append((company_phone, "Transport Company", driver_company))

	for phone, party, label in recipients:
		try:
			send_transport_sms(
				[phone],
				sms_message,
				delivery_note=doc.name,
				party=party,
				event="Transport Initiated",
				recipient_label=label,
			)
		except Exception:
			frappe.log_error(
				title=_("Ultra Dispatch Initiate SMS Failed"),
				message=frappe.get_traceback(),
			)


def _send_transport_initiated_emails(
	doc,
	*,
	transport_sales_order_name: str,
	otp: str,
	driver_name: str,
	vehicle_no: str,
	portal_link: str,
):
	"""
	Hardcoded initiate emails (templates later):
	1. Goods Customer (transport SO / initial SO customer) — thank you for initiating
	2. Transport Customer (final customer) — luggage on the road with track # + driver
	3. Ultra Transport Contact Email — initiated confirmation
	4. Original Company that created the goods DN/SO — materials are in transit
	"""
	settings = get_transport_settings()
	track_no = doc.name
	final_customer = doc.get("transport_customer_name") or "—"
	goods_customer_name = doc.get("customer_name") or doc.get("customer") or "—"

	def _safe_send(**kwargs):
		try:
			send_transport_email(**kwargs)
		except Exception:
			frappe.log_error(
				title=_("Ultra Dispatch Initiate Email Failed"),
				message=frappe.get_traceback(),
			)

	# 1) Goods customer (e.g. Crown) — their end customer is receiving the goods
	goods_email = get_customer_email(doc.get("customer"))
	destination = (doc.get("transport_address") or "").strip() or "—"
	_safe_send(
		recipients=[goods_email] if goods_email else [],
		subject=_("Your goods are on the way to {0} — {1}").format(final_customer, track_no),
		message=build_hardcoded_email(
			_("Your Goods Are On The Way"),
			[
				_("Dear {0},").format(goods_customer_name),
				_(
					"Your goods are on the way to your customer <strong>{0}</strong>."
				).format(final_customer),
				_("Tracking number: <strong>{0}</strong>").format(track_no),
				_("Delivery Note: <strong>{0}</strong>").format(track_no),
				_("Your customer: <strong>{0}</strong>").format(final_customer),
				_("Delivery address: {0}").format(destination),
				_("Driver: <strong>{0}</strong>").format(driver_name or "—"),
				_("Vehicle: {0}").format(vehicle_no or "—"),
				_("OTP: <strong>{0}</strong>").format(otp),
			],
			delivery_note=None,
		),
		reference_doctype="Delivery Note",
		reference_name=doc.name,
		delivery_note=doc.name,
		party="Goods Customer",
		event="Transport Initiated",
		recipient_label=goods_customer_name,
	)

	# 2) Final customer = Transport Customer — luggage / goods on the road
	item_lines = "<br>".join(
		f"• {frappe.utils.escape_html(row.item_name or row.item_code)} × {row.qty}"
		for row in (doc.get("items") or [])
		if row.get("item_code")
	) or "—"
	_safe_send(
		recipients=[doc.get("transport_email")] if doc.get("transport_email") else [],
		subject=_("Your delivery is on the way — {0}").format(track_no),
		message=build_hardcoded_email(
			_("Your Luggage / Goods Are On The Road"),
			[
				_("Dear {0},").format(final_customer),
				_(
					"Your delivery is on the way. Your goods are from <strong>{0}</strong>, your seller."
				).format(goods_customer_name),
				_("Tracking number: <strong>{0}</strong>").format(track_no),
				_("Driver: <strong>{0}</strong>").format(driver_name or "—"),
				_("Vehicle: {0}").format(vehicle_no or "—"),
				_("OTP for confirmation: <strong>{0}</strong>").format(otp),
				_("Delivery address: {0}").format(destination),
				_("Items:<br>{0}").format(item_lines),
			],
			delivery_note=None,
		),
		reference_doctype="Delivery Note",
		reference_name=doc.name,
		delivery_note=doc.name,
		party="Transport Customer",
		event="Transport Initiated",
		recipient_label=final_customer,
	)

	# 3) Ultra Transport Contact Email — company that handles the transport order
	transport_email = settings.get("ultra_transport_email")
	_safe_send(
		recipients=[transport_email] if transport_email else [],
		subject=_("Transport delivery initiated — {0}").format(track_no),
		message=build_hardcoded_email(
			_("Transport Delivery Initiated"),
			[
				_(
					"Transport delivery for Delivery Note <strong>{0}</strong> has been initiated."
				).format(track_no),
				_("Transport Sales Order: <strong>{0}</strong>").format(transport_sales_order_name),
				_("Goods customer: <strong>{0}</strong>").format(goods_customer_name),
				_("Final customer: <strong>{0}</strong>").format(final_customer),
				_("OTP: <strong>{0}</strong>").format(otp),
				_("Driver: <strong>{0}</strong> · Vehicle: {1}").format(
					driver_name or "—", vehicle_no or "—"
				),
			],
			delivery_note=doc,
		),
		reference_doctype="Delivery Note",
		reference_name=doc.name,
		delivery_note=doc.name,
		party="Transport Company",
		event="Transport Initiated",
		recipient_label=settings.get("ultra_transport_company") or "Ultra Transport",
	)

	# 4) Original company (e.g. Gajanan) — goods have left their premises to the final customer
	original_company = doc.get("company")
	company_email = get_company_email(original_company)
	main_invoice = get_main_company_invoice_for_delivery_note(doc.name)
	invoice_name = (main_invoice or {}).get("name") or "—"
	_safe_send(
		recipients=[company_email] if company_email else [],
		subject=_("Goods have left the premises — {0}").format(track_no),
		message=build_hardcoded_email(
			_("Goods Have Left The Premises"),
			[
				_("Dear {0},").format(original_company or "Team"),
				_(
					"The goods have left the premises and are on the way to the final customer "
					"<strong>{0}</strong>."
				).format(final_customer),
				_("Delivery Note: <strong>{0}</strong>").format(track_no),
				_("Sales Invoice: <strong>{0}</strong>").format(invoice_name),
				_("Final customer: <strong>{0}</strong>").format(final_customer),
				_("Delivery address: {0}").format(destination),
				_("Driver: <strong>{0}</strong>").format(driver_name or "—"),
				_("Vehicle: {0}").format(vehicle_no or "—"),
			],
			delivery_note=None,
		),
		reference_doctype="Delivery Note",
		reference_name=doc.name,
		delivery_note=doc.name,
		party="Original Company",
		event="Transport Initiated",
		recipient_label=original_company,
	)


def _get_linked_sales_order(doc) -> str | None:
	for item in doc.items:
		if item.against_sales_order:
			return item.against_sales_order
	return None


def _apply_transport_taxes(so, taxes_and_charges: str | None, company: str):
	"""Apply Transport Settings tax template only if it belongs to the transport company."""
	if not taxes_and_charges:
		return

	if not frappe.db.exists("Sales Taxes and Charges Template", taxes_and_charges):
		frappe.throw(
			_("Sales Taxes Template {0} in Transport Settings was not found").format(taxes_and_charges)
		)

	template_company = frappe.db.get_value(
		"Sales Taxes and Charges Template", taxes_and_charges, "company"
	)
	if template_company and template_company != company:
		frappe.throw(
			_(
				"Default Sales Taxes Template <b>{0}</b> belongs to company <b>{1}</b>, "
				"but transport orders are created for <b>{2}</b>. "
				"In Transport Settings, set Default Sales Taxes Template to a template "
				"for {2} (or clear it)."
			).format(taxes_and_charges, template_company, company)
		)

	so.taxes_and_charges = taxes_and_charges
	for tax in get_taxes_and_charges("Sales Taxes and Charges Template", taxes_and_charges):
		account = tax.get("account_head")
		if account:
			account_company = frappe.db.get_value("Account", account, "company")
			if account_company and account_company != company:
				frappe.throw(
					_(
						"Tax account <b>{0}</b> on template <b>{1}</b> belongs to <b>{2}</b>, "
						"not transport company <b>{3}</b>. "
						"Fix the template accounts or choose a template for {3} in Transport Settings."
					).format(account, taxes_and_charges, account_company, company)
				)
		so.append("taxes", tax)


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


def get_default_zone_for_transport_customer(transport_customer: str | None) -> dict | None:
	"""Return the default zone row for a transport customer (falls back to sole zone)."""
	if not transport_customer:
		return None

	rows = frappe.get_all(
		"Address Zone Detail",
		filters={"parent": transport_customer, "parenttype": "Transport Customer"},
		fields=["name", "zone", "city", "transport_charges", "default", "idx"],
		order_by="idx asc",
	)
	if not rows:
		return None

	for row in rows:
		if row.get("default"):
			return row
	if len(rows) == 1:
		return rows[0]
	return None


def get_zones_for_transport_customer(transport_customer: str | None) -> list[dict]:
	if not transport_customer:
		return []

	rows = frappe.get_all(
		"Address Zone Detail",
		filters={"parent": transport_customer, "parenttype": "Transport Customer"},
		fields=["name", "zone", "city", "transport_charges", "default", "idx"],
		order_by="idx asc",
	)
	# `default` is a reserved SQL keyword — sort in Python instead of ORDER BY.
	rows.sort(key=lambda row: (not cint(row.get("default")), row.get("idx") or 0))
	for row in rows:
		if not row.get("city") and row.get("zone"):
			row["city"] = frappe.db.get_value("Address Zone", row.zone, "zone_city")
		if not flt(row.get("transport_charges")) and row.get("zone"):
			row["transport_charges"] = flt(frappe.db.get_value("Address Zone", row.zone, "transport_charges"))
	return rows


def resolve_transport_charge(
	settings: dict | None = None,
	address_zone: str | None = None,
	transport_customer: str | None = None,
	goods_sales_order_name: str | None = None,
) -> float:
	"""Zone charge first, then Transport Settings (and legacy goods SO charge as last fallback)."""
	settings = settings or get_transport_settings()

	if address_zone and transport_customer:
		row_charge = frappe.db.get_value(
			"Address Zone Detail",
			{"parent": transport_customer, "parenttype": "Transport Customer", "zone": address_zone},
			"transport_charges",
		)
		if flt(row_charge):
			return flt(row_charge)

	if address_zone:
		zone_charge = frappe.db.get_value("Address Zone", address_zone, "transport_charges")
		if flt(zone_charge):
			return flt(zone_charge)

	return _resolve_transport_charge(goods_sales_order_name, settings)


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
