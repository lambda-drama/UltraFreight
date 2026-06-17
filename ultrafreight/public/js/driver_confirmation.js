frappe.ready(() => {
	const verifySection = document.getElementById("verify-section");
	const confirmSection = document.getElementById("confirm-section");
	const successSection = document.getElementById("success-section");
	const errorMessage = document.getElementById("error-message");
	const confirmError = document.getElementById("confirm-error");
	const driverSelect = document.getElementById("driver-select");
	const verifyBtn = document.getElementById("verify-btn");
	const driverKeyInput = document.getElementById("driver-key");
	const otpDigits = [...document.querySelectorAll(".ud-otp-digit")];

	let verifiedData = null;

	const showError = (el, message) => {
		el.textContent = message;
		el.classList.remove("d-none");
	};

	const hideError = (el) => {
		el.classList.add("d-none");
		el.textContent = "";
	};

	const setBtnLoading = (btn, loading, defaultText) => {
		btn.disabled = loading;
		btn.querySelector(".ud-btn-text").classList.toggle("d-none", loading);
		btn.querySelector(".ud-btn-spinner").classList.toggle("d-none", !loading);
		if (!loading) {
			btn.querySelector(".ud-btn-text").textContent = defaultText;
		}
	};

	const getOtpValue = () => otpDigits.map((d) => d.value).join("");

	const fillOtp = (value) => {
		const chars = (value || "").replace(/\D/g, "").slice(0, 6).split("");
		otpDigits.forEach((digit, i) => {
			digit.value = chars[i] || "";
			digit.classList.toggle("filled", !!chars[i]);
		});
	};

	// OTP digit inputs — auto-advance, paste support
	otpDigits.forEach((digit, index) => {
		digit.addEventListener("input", (e) => {
			const val = e.target.value.replace(/\D/g, "");
			e.target.value = val.slice(-1);
			e.target.classList.toggle("filled", !!e.target.value);
			if (e.target.value && index < otpDigits.length - 1) {
				otpDigits[index + 1].focus();
			}
		});

		digit.addEventListener("keydown", (e) => {
			if (e.key === "Backspace" && !digit.value && index > 0) {
				otpDigits[index - 1].focus();
			}
		});

		digit.addEventListener("paste", (e) => {
			e.preventDefault();
			const pasted = (e.clipboardData || window.clipboardData).getData("text");
			fillOtp(pasted);
			const filled = getOtpValue().length;
			otpDigits[Math.min(filled, 5)].focus();
		});
	});

	// Show/hide key
	document.getElementById("toggle-key").addEventListener("click", () => {
		const isPassword = driverKeyInput.type === "password";
		driverKeyInput.type = isPassword ? "text" : "password";
	});

	// Pre-fill key from URL (?key=xxx) — sent in SMS link
	const params = new URLSearchParams(window.location.search);
	if (params.get("key")) {
		driverKeyInput.value = params.get("key");
	}

	// Load drivers
	frappe.call({
		method: "ultrafreight.ultra_freight.api.driver_portal.get_active_drivers",
		callback(r) {
			const drivers = r.message || [];
			drivers.forEach((driver) => {
				const option = document.createElement("option");
				option.value = driver.name;
				let label = driver.full_name;
				if (driver.vehicle_number) {
					label += ` · ${driver.vehicle_number}`;
				}
				option.textContent = label;
				driverSelect.appendChild(option);
			});

			// Pre-select driver from URL (?driver=HR-DRI-...)
			const driverParam = params.get("driver");
			if (driverParam) {
				driverSelect.value = driverParam;
			}
		},
		error() {
			showError(errorMessage, __("Could not load drivers. Please refresh the page."));
		},
	});

	verifyBtn.addEventListener("click", () => {
		hideError(errorMessage);
		const driver = driverSelect.value;
		const unique_key = driverKeyInput.value.trim();
		const otp = getOtpValue();

		if (!driver) {
			showError(errorMessage, __("Please select your name"));
			driverSelect.focus();
			return;
		}
		if (!unique_key) {
			showError(errorMessage, __("Please enter your driver key"));
			driverKeyInput.focus();
			return;
		}
		if (otp.length !== 6) {
			showError(errorMessage, __("Please enter the full 6-digit OTP"));
			otpDigits[0].focus();
			return;
		}

		setBtnLoading(verifyBtn, true);

		frappe.call({
			method: "ultrafreight.ultra_freight.api.driver_portal.verify_driver_otp",
			args: { driver, unique_key, otp },
			callback(r) {
				setBtnLoading(verifyBtn, false, __("Continue"));
				if (!r.message) return;

				verifiedData = { ...r.message, driver, unique_key, otp };

				document.getElementById("driver-name-display").textContent =
					r.message.driver_name || "—";
				document.getElementById("customer-name").textContent =
					r.message.customer_name || "—";
				document.getElementById("customer-address").textContent =
					r.message.address || "—";
				document.getElementById("delivery-note-name").textContent =
					r.message.delivery_note;

				const itemsList = document.getElementById("items-list");
				itemsList.innerHTML = "";
				(r.message.items || []).forEach((item) => {
					const li = document.createElement("li");
					li.textContent = `${item.item_name || item.item_code} × ${item.qty}`;
					itemsList.appendChild(li);
				});

				verifySection.classList.add("d-none");
				confirmSection.classList.remove("d-none");
				window.scrollTo({ top: 0, behavior: "smooth" });
			},
			error(r) {
				setBtnLoading(verifyBtn, false, __("Continue"));
				showError(
					errorMessage,
					r.message || __("Verification failed. Check your name, key, and OTP.")
				);
			},
		});
	});

	document.getElementById("back-btn").addEventListener("click", () => {
		hideError(confirmError);
		confirmSection.classList.add("d-none");
		verifySection.classList.remove("d-none");
		verifiedData = null;
	});

	document.getElementById("confirm-btn").addEventListener("click", () => {
		hideError(confirmError);
		if (!verifiedData) return;

		const confirmBtn = document.getElementById("confirm-btn");
		setBtnLoading(confirmBtn, true, confirmBtn.querySelector(".ud-btn-text").textContent);

		frappe.call({
			method: "ultrafreight.ultra_freight.api.driver_portal.confirm_delivery",
			args: {
				driver: verifiedData.driver,
				unique_key: verifiedData.unique_key,
				otp: verifiedData.otp,
				delivery_note: verifiedData.delivery_note,
			},
			callback() {
				document.getElementById("success-dn").textContent = verifiedData.delivery_note;
				confirmSection.classList.add("d-none");
				successSection.classList.remove("d-none");
				window.scrollTo({ top: 0, behavior: "smooth" });
			},
			error(r) {
				setBtnLoading(
					confirmBtn,
					false,
					`✓ ${__("Confirm Goods Delivered")}`
				);
				showError(confirmError, r.message || __("Confirmation failed. Please try again."));
			},
		});
	});
});
