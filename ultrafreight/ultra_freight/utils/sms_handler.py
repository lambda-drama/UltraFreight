import frappe
from frappe import _

from ultrafreight.ultra_freight.utils.sms_log import create_delivery_sms_log
from ultrafreight.ultra_freight.utils.transport_settings import get_transport_settings


def send_transport_sms(
	receiver_list: list[str],
	message: str,
	*,
	delivery_note: str | None = None,
	party: str | None = None,
	event: str | None = None,
	recipient_label: str | None = None,
) -> None:
	"""Send SMS when configured; otherwise skip quietly so workflows are never blocked."""
	settings = get_transport_settings()
	numbers = [_format_phone(number, settings.get("default_country_code")) for number in receiver_list]
	numbers = [n for n in numbers if n]

	if not numbers:
		if delivery_note and party and event:
			create_delivery_sms_log(
				delivery_note=delivery_note,
				party=party,
				event=event,
				message=message,
				recipient_label=recipient_label,
				status="Skipped",
				error=_("No phone number available"),
			)
		return

	if not settings.get("enable_sms"):
		_log_skip_for_numbers(
			numbers,
			message,
			delivery_note=delivery_note,
			party=party,
			event=event,
			recipient_label=recipient_label,
			status="Disabled",
			error=_("SMS is disabled in Transport Settings"),
		)
		return

	if not _is_sms_configured(settings):
		_log_skip_for_numbers(
			numbers,
			message,
			delivery_note=delivery_note,
			party=party,
			event=event,
			recipient_label=recipient_label,
			status="Skipped",
			error=_("SMS Settings not configured yet"),
		)
		return

	provider = settings.get("sms_provider")
	for number in numbers:
		try:
			if provider and provider != "Frappe SMS Settings":
				_send_via_custom_provider([number], message, settings)
			else:
				_send_via_frappe_sms([number], message)

			if delivery_note and party and event:
				create_delivery_sms_log(
					delivery_note=delivery_note,
					party=party,
					event=event,
					message=message,
					recipient=number,
					recipient_label=recipient_label,
					status="Sent",
				)
		except Exception:
			error = frappe.get_traceback()
			frappe.log_error(title=_("Ultra Dispatch SMS Failed"), message=error)
			if delivery_note and party and event:
				create_delivery_sms_log(
					delivery_note=delivery_note,
					party=party,
					event=event,
					message=message,
					recipient=number,
					recipient_label=recipient_label,
					status="Failed",
					error=error.splitlines()[-1] if error else _("SMS send failed"),
				)


def _is_sms_configured(settings: dict) -> bool:
	"""True only when a usable SMS gateway is set up."""
	provider = (settings.get("sms_provider") or "").strip()
	if provider and provider not in ("Frappe SMS Settings",):
		# Custom provider selected — need URL or API key at minimum
		if settings.get("sms_api_url") or settings.get("sms_api_key"):
			return True
	# Default / Frappe SMS Settings path
	return bool(frappe.db.get_single_value("SMS Settings", "sms_gateway_url"))


def _log_skip_for_numbers(
	numbers: list[str],
	message: str,
	*,
	delivery_note: str | None,
	party: str | None,
	event: str | None,
	recipient_label: str | None,
	status: str,
	error: str,
) -> None:
	if not (delivery_note and party and event):
		return
	for number in numbers:
		create_delivery_sms_log(
			delivery_note=delivery_note,
			party=party,
			event=event,
			message=message,
			recipient=number,
			recipient_label=recipient_label,
			status=status,
			error=error,
		)


def _format_phone(phone: str, country_code: str | None) -> str:
	phone = (phone or "").strip()
	if not phone:
		return ""
	if phone.startswith("+"):
		return phone
	if country_code and not phone.startswith(country_code.lstrip("+")):
		return f"{country_code}{phone.lstrip('0')}"
	return phone


def _send_via_frappe_sms(receiver_list: list[str], message: str) -> None:
	from frappe.core.doctype.sms_settings.sms_settings import send_sms

	send_sms(receiver_list=receiver_list, msg=message, success_msg=False)


def _send_via_custom_provider(receiver_list: list[str], message: str, settings: dict) -> None:
	frappe.logger("ultra_dispatch").info(
		"SMS via %s to %s: %s", settings.get("sms_provider"), receiver_list, message
	)
	_send_via_frappe_sms(receiver_list, message)
