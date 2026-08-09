import re

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
	country_code = settings.get("default_country_code")
	raw_numbers: list[str] = []
	for entry in receiver_list or []:
		raw_numbers.extend(_split_phone_entries(entry))
	numbers = [_format_phone(number, country_code) for number in raw_numbers]
	# de-dupe while preserving order
	seen = set()
	unique_numbers = []
	for number in numbers:
		if not number or number in seen:
			continue
		seen.add(number)
		unique_numbers.append(number)
	numbers = unique_numbers

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


def _split_phone_entries(value) -> list[str]:
	"""Split a phone field that may contain multiple numbers."""
	if value is None:
		return []
	if isinstance(value, (list, tuple, set)):
		entries = []
		for item in value:
			entries.extend(_split_phone_entries(item))
		return entries
	text = str(value).strip()
	if not text:
		return []
	parts = re.split(r"[,;/|\n]+", text)
	return [part.strip() for part in parts if part and part.strip()]


def _digits_only(value: str) -> str:
	return re.sub(r"\D", "", value or "")


def _collapse_duplicated_digits(digits: str) -> str:
	"""If the same number was pasted twice back-to-back, keep one copy."""
	if len(digits) < 16 or len(digits) % 2:
		return digits
	half = len(digits) // 2
	first, second = digits[:half], digits[half:]
	if first == second:
		return first
	# Common local+international paste: 07xxxxxxxx + 2567xxxxxxxx
	if half >= 9 and second.endswith(first.lstrip("0")):
		return second
	if half >= 9 and first.endswith(second.lstrip("0")):
		return first
	return digits


def _format_phone(phone: str, country_code: str | None) -> str:
	"""Normalize to +<country><national> without doubling the country code."""
	phone = (phone or "").strip()
	if not phone:
		return ""

	cc = (country_code or "").strip()
	cc_digits = _digits_only(cc)

	# Keep an explicit + if present, otherwise work from digits
	digits = _digits_only(phone)
	if not digits:
		return ""

	digits = _collapse_duplicated_digits(digits)

	# International 00 prefix → treat as country-coded
	if digits.startswith("00") and len(digits) > 4:
		digits = digits[2:]

	if cc_digits:
		# Already includes country code (with or without leading 0 before CC)
		if digits.startswith(cc_digits):
			return f"+{digits}"
		if digits.startswith(f"0{cc_digits}"):
			return f"+{digits[1:]}"
		# Local number with leading 0 (e.g. 07xxxxxxxx)
		if digits.startswith("0"):
			return f"+{cc_digits}{digits.lstrip('0')}"
		# Bare national number
		return f"+{cc_digits}{digits}"

	if phone.startswith("+"):
		return f"+{digits}"
	return digits


def _send_via_frappe_sms(receiver_list: list[str], message: str) -> None:
	from frappe.core.doctype.sms_settings.sms_settings import send_sms

	send_sms(receiver_list=receiver_list, msg=message, success_msg=False)


def _send_via_custom_provider(receiver_list: list[str], message: str, settings: dict) -> None:
	frappe.logger("ultra_dispatch").info(
		"SMS via %s to %s: %s", settings.get("sms_provider"), receiver_list, message
	)
	_send_via_frappe_sms(receiver_list, message)
