Project Specification: ColdGuard
Context: Rural Ghana Vaccine Cold-Chain Integrity

1. Project Overview
ColdGuard Ghana is a ruggedized, intelligent monitoring system designed to protect the integrity of vaccines and medicines in rural healthcare settings. By addressing the specific challenges of "Dumsor" (power outages) and the "Field Gap" (outreach trips), ColdGuard ensures that life-saving supplies remain medically viable from the regional clinic to the furthest village.

2. Hardware Architecture & Component Selection
Component	Choice	Reason for Selection
Microcontroller	ESP32 (Standard)	High processing power for MKT math, built-in Bluetooth (BLE) and WiFi, and robust deep-sleep modes.
Primary Sensor	DS18B20 (Probe)	Waterproof and highly accurate within the \(2^\circ C\) to \(8^\circ C\) vaccine safety range.
Door Sensor	Magnetic Reed Switch	Detects open fridge doors or carrier lids. Essential for preventing human-error spoilage.
Storage	SD Card Module	The "Source of Truth" for offline data logging. Prevents data loss during network/power outages.
Power Management	TP4056 + 18650	1S configuration for high efficiency. Easily charged via standard USB-C/Micro-USB phone chargers.
User Interface	0.96" OLED I2C	Provides instant status (Temp, MKT, Battery) to nurses without requiring a mobile phone.
Controls	Capacitive Touch	Hidden behind the case wall; allows for a 100% waterproof "no-hole" design with no mechanical parts.
Alerts	Piezo Buzzer	Audio feedback for heat spikes, low battery, or door-open events.

3. Data Integrity & Safety Metrics
Mean Kinetic Temperature (MKT)
Unlike simple averages, ColdGuard calculates MKT using the Arrhenius equation to express cumulative thermal stress.
•	Formula: Uses an activation energy \(\Delta H\) of \(83.144 \text{ kJ/mol}\).
•	Safety Logic: Proves whether a batch is medically safe after a "Dumsor" event or heat spike.
Real-Time Door Monitoring
The Magnetic Reed Switch acts as a critical fail-safe. If the fridge door or vaccine carrier lid is left open for more than a set duration (e.g., 2 minutes), the device triggers a high-pitched buzzer and logs a "Door Open" event to the SD card.

4. Connectivity & Sync Strategy
To thrive in low-connectivity zones, ColdGuard utilizes a Store-and-Forward architecture:
1.	Local Logging: ESP32 logs data to the SD card every 10 minutes.
2.	BLE Discovery: The Expo App detects the device via Bluetooth Low Energy without manual pairing.
3.	High-Speed Sync: For large log transfers, the App automatically triggers the ESP32 WiFi Access Point to download the CSV data.
4.	Cloud Bridge: Once the mobile device has internet, it pushes logs to Convex for central institutional monitoring.

5. Physical & Environmental Ruggedization
Waterproofing & Condensation
•	Airtight Enclosure: No-hole design using capacitive touch and a sealed acrylic window for the OLED.
•	Cable Management: A PG7 Cable Gland is used to seal the entry point for the DS18B20 and Reed Switch wires.
•	Conformal Coating: All internal PCBs are coated in a protective layer (silicone/clear polish) to prevent corrosion from high humidity and condensation inside the fridge.
Outreach Ready
•	Vibration Resistance: Designed for motorbike transport. Components are soldered or mechanically clamped—no loose breadboard wires.
•	Thermal Resilience: Case printed in PETG to prevent warping in the high ambient temperatures of Ghana.

6. Software & Authentication (Auth)
User Management
•	Identity Provider:Firebase Auth (supporting Google Sign-In and Email/Password).
•	Institutional Security: Convex maps "Nurses" to specific "Clinics" or "Health Institutions."
•	Offline Authentication: During online setup, the App downloads a Clinic Secret Key. This key allows the App to verify itself with the ESP32 while offline in the field via a BLE handshake.

7. User Experience (UX)
•	At-a-Glance Dashboard: The OLED shows Current Temp, MKT, and Battery level.
•	Guided Troubleshooting: The screen displays clear error codes: "NO SD CARD," "CHECK DOOR," or "LOW BATT."
•	Field Configuration: Capacitive touch buttons allow nurses to acknowledge alarms or reset the MKT calculation when a new vaccine shipment arrives.

ColdGuard Ghana represents a leap forward in rural medical accountability, transforming a standard refrigerator into a smart, pharmaceutical-grade storage unit.