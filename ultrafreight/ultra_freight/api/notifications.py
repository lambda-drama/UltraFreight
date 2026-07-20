import frappe
from frappe import _
from frappe.utils import now_datetime

from ultrafreight.ultra_freight.utils.email_handler import format_delivery_note_email, send_transport_email
from ultrafreight.ultra_freight.utils.sms_handler import send_transport_sms
from ultrafreight.ultra_freight.utils.transport_settings import get_driver_portal_url, get_transport_settings


def notify_goods_ready(delivery_note_name: str):
	"""Legacy helper — transport company is notified when the transport sales order is created."""
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	if not doc.get("require_direct_delivery"):
		return

	settings = get_transport_settings()
	email = settings.get("ultra_transport_email")
	subject = _("Goods ready for dispatch - {0}").format(doc.name)
	message = format_delivery_note_email(
		doc, _("Goods are ready for dispatch. Please arrange pickup.")
	)
	if email:
		send_transport_email([email], subject, message, "Delivery Note", doc.name)

	sms_message = _("Goods ready for dispatch. DN: {0}. Please arrange pickup.").format(doc.name)
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
	doc = frappe.get_doc("Delivery Note", delivery_note_name)
	driver = frappe.get_doc("Driver", doc.driver) if doc.driver else None
	driver_name = driver.full_name if driver else ""
	vehicle_no = doc.get("vehicle_no") or (driver.get("vehicle_number") if driver else "")

	sms_message = _(
		"Your goods are on the way! OTP: {0}. Driver: {1}, Vehicle: {2}"
	).format(doc.otp, driver_name, vehicle_no)
	send_transport_sms(
		[doc.get("transport_phone")],
		sms_message,
		delivery_note=doc.name,
		party="Transport Customer",
		event="On The Way",
		recipient_label=doc.get("transport_customer_name"),
	)

	portal_link = get_driver_portal_url()
	email_body = format_delivery_note_email(
		doc,
		_(
			"Your goods are on the way!<br>OTP: <strong>{0}</strong><br>"
			"Driver: {1}<br>Vehicle: {2}<br>Portal: <a href='{3}'>{3}</a>"
		).format(doc.otp, driver_name, vehicle_no, portal_link),
	)
	if doc.get("transport_email"):
		send_transport_email(
			[doc.transport_email],
			_("Your delivery is on the way - {0}").format(doc.name),
			email_body,
			"Delivery Note",
			doc.name,
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

	crown_email = frappe.db.get_value("Customer", crown_customer, "email_id") if crown_customer else None
	crown_phone = frappe.db.get_value("Customer", crown_customer, "mobile_no") if crown_customer else None

	messages = [
		(driver_phone, "Driver", driver_phone and frappe.db.get_value("Driver", doc.driver, "full_name")),
		(settings.get("ultra_transport_email"), "Transport Company", settings.get("ultra_transport_company")),
		(crown_phone or crown_email, "Goods Customer", crown_customer),
		(doc.get("transport_phone"), "Transport Customer", doc.get("transport_customer_name")),
	]

	for recipient, party, label in messages:
		if not recipient:
			continue
		message = {
			"Driver": _("Delivery confirmed! Thank you for your service."),
			"Transport Company": _("Delivery confirmed for DN: {0}").format(doc.name),
			"Goods Customer": _("Delivery confirmed for your order: {0}").format(sales_order_name or doc.name),
			"Transport Customer": _("Goods delivered successfully! Thank you for your business."),
		}[party]
		if "@" in str(recipient):
			send_transport_email([recipient], _("Delivery Confirmed"), message, "Delivery Note", doc.name)
		else:
			send_transport_sms(
				[recipient],
				message,
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
