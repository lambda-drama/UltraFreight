import frappe
from frappe.utils import now_datetime


def create_delivery_sms_log(
	delivery_note: str,
	party: str,
	event: str,
	message: str,
	recipient: str | None = None,
	recipient_label: str | None = None,
	status: str = "Pending",
	error: str | None = None,
) -> str | None:
	if not delivery_note:
		return None

	log = frappe.get_doc(
		{
			"doctype": "Delivery SMS Log",
			"delivery_note": delivery_note,
			"party": party,
			"event": event,
			"recipient": recipient or "",
			"recipient_label": recipient_label,
			"message": message,
			"status": status,
			"sent_at": now_datetime() if status == "Sent" else None,
			"error": error,
		}
	)
	log.insert(ignore_permissions=True)
	update_delivery_sms_status(delivery_note)
	return log.name


def update_delivery_sms_status(delivery_note: str) -> None:
	if not frappe.db.exists("DocType", "Delivery SMS Log"):
		return

	logs = frappe.get_all(
		"Delivery SMS Log",
		filters={"delivery_note": delivery_note},
		fields=["status"],
	)
	if not logs:
		summary = "Not Sent"
	else:
		statuses = {row.status for row in logs}
		if statuses <= {"Skipped", "Disabled"}:
			summary = "Not Sent"
		elif "Failed" in statuses and "Sent" not in statuses:
			summary = "Failed"
		elif "Sent" in statuses and statuses - {"Sent"}:
			summary = "Partially Sent"
		elif statuses == {"Sent"}:
			summary = "Sent"
		else:
			summary = "Partially Sent"

	frappe.db.set_value(
		"Delivery Note",
		delivery_note,
		"sms_status",
		summary,
		update_modified=False,
	)


def get_delivery_sms_logs(delivery_note: str | None = None, limit: int = 200) -> list[dict]:
	if not frappe.db.exists("DocType", "Delivery SMS Log"):
		return []

	filters = {}
	if delivery_note:
		filters["delivery_note"] = delivery_note

	return frappe.get_all(
		"Delivery SMS Log",
		filters=filters,
		fields=[
			"name",
			"delivery_note",
			"party",
			"event",
			"recipient",
			"recipient_label",
			"message",
			"status",
			"sent_at",
			"error",
			"creation",
		],
		order_by="creation desc",
		limit=limit,
	)
