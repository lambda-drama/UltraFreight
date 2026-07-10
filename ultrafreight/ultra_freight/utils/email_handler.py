import frappe
from frappe import _
from frappe.utils import get_url_to_form


def has_outgoing_email_account() -> bool:
	try:
		from frappe.email.doctype.email_account.email_account import EmailAccount

		return bool(EmailAccount.find_outgoing(_raise_error=False))
	except Exception:
		return False


def send_transport_email(recipients: list[str], subject: str, message: str, reference_doctype=None, reference_name=None):
	recipients = [email for email in recipients if email]
	if not recipients:
		return

	if not has_outgoing_email_account():
		frappe.logger("ultra_dispatch").info(
			"Skipping transport email to %s — no outgoing Email Account configured", recipients
		)
		return

	try:
		frappe.sendmail(
			recipients=recipients,
			subject=subject,
			message=message,
			reference_doctype=reference_doctype,
			reference_name=reference_name,
			now=True,
		)
	except Exception:
		frappe.log_error(title=_("Ultra Dispatch Email Failed"), message=frappe.get_traceback())


def format_delivery_note_email(delivery_note, extra_message: str = "") -> str:
	link = get_url_to_form("Delivery Note", delivery_note.name)
	items = "<br>".join(
		f"• {item.item_name or item.item_code} x {item.qty}" for item in delivery_note.items
	)
	return f"""
	<p>{extra_message}</p>
	<p><strong>Delivery Note:</strong> {delivery_note.name}</p>
	<p><strong>Transport Customer:</strong> {delivery_note.get('transport_customer_name') or ''}</p>
	<p><strong>Address:</strong> {delivery_note.get('transport_address') or ''}</p>
	<p><strong>Items:</strong><br>{items}</p>
	<p><a href="{link}">View Delivery Note</a></p>
	"""
