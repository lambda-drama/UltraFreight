import frappe
from frappe import _
from frappe.utils import get_url_to_form


def has_outgoing_email_account() -> bool:
	"""True only when an outgoing Email Account exists and its password can be used."""
	try:
		from frappe.email.doctype.email_account.email_account import EmailAccount

		account = EmailAccount.find_outgoing(_raise_error=False)
		if not account:
			return False
		# Encryption-key / password problems surface here — treat as "not ready"
		account.get_password(raise_exception=True)
		return True
	except Exception:
		_clear_email_error_messages()
		return False


def send_transport_email(
	recipients: list[str],
	subject: str,
	message: str,
	reference_doctype=None,
	reference_name=None,
):
	"""Queue a transport notification email. Never blocks the business workflow."""
	recipients = [email for email in recipients if email]
	if not recipients:
		return

	if not has_outgoing_email_account():
		frappe.logger("ultra_dispatch").info(
			"Skipping transport email to %s — outgoing email not available", recipients
		)
		return

	try:
		# Queue asynchronously so SMTP/decrypt failures cannot fail the request
		frappe.sendmail(
			recipients=recipients,
			subject=subject,
			message=message,
			reference_doctype=reference_doctype,
			reference_name=reference_name,
			now=False,
			delayed=True,
		)
	except Exception:
		_clear_email_error_messages()
		frappe.log_error(title=_("Ultra Dispatch Email Failed"), message=frappe.get_traceback())


def _clear_email_error_messages() -> None:
	"""Drop ValidationError toast leftovers from failed email probes/sends."""
	try:
		if hasattr(frappe, "clear_last_message"):
			frappe.clear_last_message()
		message_log = getattr(frappe.local, "message_log", None)
		if not message_log:
			return
		kept = []
		for entry in message_log:
			text = str(entry).lower()
			if any(
				token in text
				for token in (
					"decrypt",
					"encryption key",
					"email account",
					"smtp",
					"outgoing email",
				)
			):
				continue
			kept.append(entry)
		frappe.local.message_log = kept
	except Exception:
		pass


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
