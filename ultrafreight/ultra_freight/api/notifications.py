import frappe
from frappe import _
from frappe.utils import now_datetime

from ultrafreight.ultra_freight.utils.email_handler import (
	build_hardcoded_email,
	send_transport_email,
)
from ultrafreight.ultra_freight.utils.sms_handler import send_transport_sms
from ultrafreight.ultra_freight.utils.transport_settings import get_driver_portal_url, get_transport_settings


def notify_goods_ready(delivery_note_name: str):
	"""Legacy helper — transport company is notified when the transport sales order is created."""
	notify_transport_company_pending_dispatch_inline(delivery_note_name, transport_sales_order=None)


def notify_transport_company_pending_dispatch_inline(
	delivery_note_name: str, transport_sales_order: str | None = None
):
	"""Email Ultra Transport Contact Email that a transport order needs action."""
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	if not doc.get("require_direct_delivery"):
		return

	settings = get_transport_settings()
	email = settings.get("ultra_transport_email")
	so_text = transport_sales_order or doc.get("transport_sales_order") or ""
	subject = _("Action required: Transport order created for {0}").format(doc.name)
	message = build_hardcoded_email(
		_("Transport Order Needs Your Action"),
		[
			_(
				"A transport order has been created and needs your action."
			),
			_(
				"Draft Sales Order <strong>{0}</strong> was created for Delivery Note <strong>{1}</strong>."
			).format(so_text, doc.name)
			if so_text
			else _("A draft transport Sales Order was created for Delivery Note <strong>{0}</strong>.").format(
				doc.name
			),
			_(
				"Please review the quantity or amount if needed, then submit the transport order "
				"to initiate dispatch."
			),
			_("Transport Customer: <strong>{0}</strong>").format(doc.get("transport_customer_name") or "—"),
			_("Delivery Address: {0}").format(doc.get("transport_address") or "—"),
		],
		delivery_note=doc,
	)
	send_transport_email(
		[email] if email else [],
		subject,
		message,
		"Delivery Note",
		doc.name,
		delivery_note=doc.name,
		party="Transport Company",
		event="Draft Transport Order",
		recipient_label=settings.get("ultra_transport_company") or "Ultra Transport",
	)

	sms_message = _(
		"Draft transport SO {0} created for DN {1}. Review amount/qty, then submit to initiate dispatch."
	).format(so_text or "—", doc.name)
	phone = frappe.db.get_value("Company", settings.get("ultra_transport_company"), "phone_no")
	if phone:
		send_transport_sms(
			[phone],
			sms_message,
			delivery_note=doc.name,
			party="Transport Company",
			event="Draft Transport Order",
			recipient_label=settings.get("ultra_transport_company"),
		)


def notify_on_the_way(delivery_note_name: str):
	"""SMS the transport customer that goods are on the way. Emails are handled on initiate."""
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	driver = frappe.get_doc("Driver", doc.driver) if doc.driver else None
	driver_name = driver.full_name if driver else ""
	vehicle_no = doc.get("vehicle_no") or (driver.get("vehicle_number") if driver else "")

	sms_message = _(
		"Your goods are on the way! OTP: {0}. Driver: {1}, Vehicle: {2}"
	).format(doc.otp or "—", driver_name, vehicle_no)
	send_transport_sms(
		[doc.get("transport_phone")],
		sms_message,
		delivery_note=doc.name,
		party="Transport Customer",
		event="On The Way",
		recipient_label=doc.get("transport_customer_name"),
	)


def notify_driver_arrival(delivery_note_name: str):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	if not doc.driver:
		return

	driver = frappe.get_doc("Driver", doc.driver)
	portal_link = get_driver_portal_url(f"driver={driver.name}&key={driver.unique_key}")
	sms_message = _("Confirm your delivery here: {0}").format(portal_link)
	send_transport_sms(
		[driver.cell_number],
		sms_message,
		delivery_note=doc.name,
		party="Driver",
		event="Driver Portal",
		recipient_label=driver.full_name,
	)


def notify_delivery_confirmed(delivery_note_name: str, sales_order_name: str | None = None):
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	settings = get_transport_settings()

	driver_phone = frappe.db.get_value("Driver", doc.driver, "cell_number") if doc.driver else None
	crown_customer = None
	if sales_order_name:
		crown_customer = frappe.db.get_value("Sales Order", sales_order_name, "customer")
	if not crown_customer:
		crown_customer = doc.get("customer")

	crown_email = frappe.db.get_value("Customer", crown_customer, "email_id") if crown_customer else None
	crown_phone = frappe.db.get_value("Customer", crown_customer, "mobile_no") if crown_customer else None

	# SMS recipients
	sms_targets = [
		(driver_phone, "Driver", driver_phone and frappe.db.get_value("Driver", doc.driver, "full_name")),
		(crown_phone, "Goods Customer", crown_customer),
		(doc.get("transport_phone"), "Transport Customer", doc.get("transport_customer_name")),
	]
	for recipient, party, label in sms_targets:
		if not recipient:
			continue
		message = {
			"Driver": _("Delivery confirmed! Thank you for your service."),
			"Goods Customer": _("Delivery confirmed for your order: {0}").format(sales_order_name or doc.name),
			"Transport Customer": _("Goods delivered successfully! Thank you for your business."),
		}[party]
		send_transport_sms(
			[recipient],
			message,
			delivery_note=doc.name,
			party=party,
			event="Delivery Confirmed",
			recipient_label=label,
		)

	# Email recipients
	email_targets = [
		(
			settings.get("ultra_transport_email"),
			"Transport Company",
			settings.get("ultra_transport_company"),
			_("Delivery confirmed for DN: {0}").format(doc.name),
		),
		(
			crown_email,
			"Goods Customer",
			crown_customer,
			_("Delivery confirmed for your order: {0}").format(sales_order_name or doc.name),
		),
		(
			doc.get("transport_email"),
			"Transport Customer",
			doc.get("transport_customer_name"),
			_("Goods delivered successfully! Thank you for your business."),
		),
	]
	for recipient, party, label, message in email_targets:
		if not recipient:
			continue
		send_transport_email(
			[recipient],
			_("Delivery Confirmed"),
			message,
			"Delivery Note",
			doc.name,
			delivery_note=doc.name,
			party=party,
			event="Delivery Confirmed",
			recipient_label=label,
		)


def create_confirmation_log(
	delivery_note_name: str,
	sales_order_name: str | None,
	driver_name: str | None,
	transport_customer: str | None,
	otp: str | None = None,
	status: str = "Open",
	completion_type: str | None = None,
	partial_reason: str | None = None,
	items: list | None = None,
	ip_address: str | None = None,
	gps_location: str | None = None,
) -> str:
	log = frappe.get_doc(
		{
			"doctype": "Delivery Confirmation Log",
			"delivery_note": delivery_note_name,
			"sales_order": sales_order_name,
			"driver": driver_name,
			"transport_customer": transport_customer,
			"otp": otp,
			"confirmation_time": now_datetime(),
			"status": status,
			"completion_type": completion_type,
			"partial_reason": partial_reason,
			"ip_address": ip_address,
			"gps_location": gps_location,
		}
	)
	if items:
		for row in items:
			log.append(
				"items",
				{
					"item_code": row.get("item_code"),
					"item_name": row.get("item_name"),
					"qty_ordered": row.get("qty_ordered") or row.get("qty"),
					"qty_delivered": row.get("qty_delivered"),
					"uom": row.get("uom"),
				},
			)
	log.insert(ignore_permissions=True)
	return log.name


def get_driver_display(delivery_note) -> tuple[str, str]:
	"""Return (driver_name, vehicle_no) for email templates."""
	driver_name = ""
	vehicle_no = delivery_note.get("vehicle_no") or ""
	if delivery_note.get("driver"):
		driver = frappe.db.get_value(
			"Driver",
			delivery_note.driver,
			["full_name", "vehicle_number"],
			as_dict=True,
		)
		if driver:
			driver_name = driver.full_name or delivery_note.driver
			vehicle_no = vehicle_no or driver.vehicle_number or ""
	return driver_name, vehicle_no


def get_company_email(company: str | None) -> str | None:
	if not company:
		return None
	return frappe.db.get_value("Company", company, "email")


def get_customer_email(customer: str | None) -> str | None:
	if not customer:
		return None
	return frappe.db.get_value("Customer", customer, "email_id")
