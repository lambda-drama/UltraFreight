import frappe
from frappe import _
from frappe.utils import get_url_to_form

from ultrafreight.ultra_freight.utils.email_log import create_delivery_email_log
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


def send_transport_email(
	recipients: list[str],
	subject: str,
	message: str,
	reference_doctype=None,
	reference_name=None,
	*,
	delivery_note: str | None = None,
	party: str | None = None,
	event: str | None = None,
	recipient_label: str | None = None,
):
	"""Enqueue into Frappe Email Queue and write Delivery Email Log when Enable Email is on."""
	settings = get_transport_settings()
	if not settings.get("enable_email"):
		return

	recipients = [str(email).strip() for email in (recipients or []) if email and str(email).strip()]
	seen = set()
	unique_recipients = []
	for email in recipients:
		key = email.lower()
		if key in seen:
			continue
		seen.add(key)
		unique_recipients.append(email)
	recipients = unique_recipients

	if not recipients:
		if delivery_note and party and event:
			create_delivery_email_log(
				delivery_note=delivery_note,
				party=party,
				event=event,
				subject=subject,
				message=message,
				recipient_label=recipient_label,
				status="Skipped",
				error=_("No email address available"),
			)
		return

	for email in recipients:
		queue_name = None
		error_note = None
		try:
			queue_name = _queue_via_sendmail(
				recipient=email,
				subject=subject,
				message=message,
				reference_doctype=reference_doctype,
				reference_name=reference_name,
			)
		except Exception:
			_clear_email_error_messages()
			frappe.log_error(
				title=_("Ultra Dispatch sendmail failed"),
				message=frappe.get_traceback(),
			)

		if not queue_name:
			try:
				queue_name = _create_email_queue_entry(
					recipient=email,
					subject=subject,
					message=message,
					reference_doctype=reference_doctype,
					reference_name=reference_name,
				)
				error_note = _("Created Email Queue directly (sendmail did not queue)")
			except Exception:
				_clear_email_error_messages()
				error = frappe.get_traceback()
				frappe.log_error(title=_("Ultra Dispatch Email Failed"), message=error)
				if delivery_note and party and event:
					create_delivery_email_log(
						delivery_note=delivery_note,
						party=party,
						event=event,
						subject=subject,
						message=message,
						recipient=email,
						recipient_label=recipient_label,
						status="Failed",
						error=error[-500:],
					)
				continue

		if delivery_note and party and event:
			create_delivery_email_log(
				delivery_note=delivery_note,
				party=party,
				event=event,
				subject=subject,
				message=message,
				recipient=email,
				recipient_label=recipient_label,
				status="Sent",
				error=(f"Email Queue: {queue_name}" + (f" — {error_note}" if error_note else "")),
			)


def _queue_via_sendmail(
	*,
	recipient: str,
	subject: str,
	message: str,
	reference_doctype=None,
	reference_name=None,
) -> str | None:
	"""Use Frappe sendmail and return the Email Queue name if one was created."""
	before = _latest_email_queue_name(recipient)

	result = frappe.sendmail(
		recipients=[recipient],
		subject=subject,
		message=message,
		reference_doctype=reference_doctype,
		reference_name=reference_name,
		now=False,
		delayed=True,
		is_notification=True,
		add_unsubscribe_link=0,
	)
	_clear_email_error_messages()

	if result:
		# QueueBuilder.process returns Email Queue doc or list
		if isinstance(result, list):
			for row in result:
				name = getattr(row, "name", None) or (row.get("name") if isinstance(row, dict) else None)
				if name:
					return name
		name = getattr(result, "name", None)
		if name:
			return name

	after = _latest_email_queue_name(recipient)
	if after and after != before:
		return after
	return after or None


def _latest_email_queue_name(recipient: str) -> str | None:
	try:
		return frappe.db.sql(
			"""
			select q.name
			from `tabEmail Queue` q
			inner join `tabEmail Queue Recipient` r on r.parent = q.name
			where r.recipient = %s
			order by q.creation desc
			limit 1
			""",
			recipient,
		)[0][0]
	except Exception:
		return None


def _create_email_queue_entry(
	*,
	recipient: str,
	subject: str,
	message: str,
	reference_doctype=None,
	reference_name=None,
) -> str:
	"""Insert a Not Sent Email Queue row when sendmail does not create one."""
	from email.utils import make_msgid

	from frappe.email.doctype.email_account.email_account import EmailAccount

	account = EmailAccount.find_outgoing(_raise_error=False)
	if account:
		sender = account.email_id
		account_name = account.name if getattr(account, "is_exists_in_db", lambda: False)() else None
	else:
		sender = (
			frappe.db.get_value(
				"Email Account",
				{"enable_outgoing": 1, "default_outgoing": 1},
				"email_id",
			)
			or frappe.utils.get_formatted_email(frappe.session.user)
			or "notifications@example.com"
		)
		account_name = frappe.db.get_value(
			"Email Account",
			{"enable_outgoing": 1, "default_outgoing": 1},
			"name",
		)

	message_id = make_msgid(domain=(sender.split("@")[-1] if "@" in str(sender) else "example.com"))
	html = message or ""
	raw = (
		f"From: {sender}\r\n"
		f"To: {recipient}\r\n"
		f"Subject: {subject}\r\n"
		f"MIME-Version: 1.0\r\n"
		f'Content-Type: text/html; charset="utf-8"\r\n'
		f"Message-ID: {message_id}\r\n"
		f"\r\n"
		f"{html}"
	)

	doc = frappe.get_doc(
		{
			"doctype": "Email Queue",
			"priority": 1,
			"sender": sender,
			"message": raw,
			"message_id": message_id.strip("<>"),
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"status": "Not Sent",
			"email_account": account_name,
			"add_unsubscribe_link": 0,
		}
	)
	doc.append("recipients", {"recipient": recipient, "status": "Not Sent"})
	doc.insert(ignore_permissions=True)
	return doc.name


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


def build_hardcoded_email(title: str, paragraphs: list[str], delivery_note=None) -> str:
	"""Simple hardcoded HTML email body. Templates can replace this later."""
	body = "".join(f"<p>{p}</p>" for p in paragraphs if p)
	if delivery_note:
		body += format_delivery_note_email(delivery_note, "")
	return f"<h3>{title}</h3>{body}"
