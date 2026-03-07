# Electronic Design Specification: ColdGuard Ghana (v1.2)

## 1. System Control & Logic
*   **Core Component:** **ESP32 Development Board (30-pin)**
*   **Role:** The "Brain." It manages data acquisition, performs the Mean Kinetic Temperature (MKT) logarithmic math, handles Bluetooth Low Energy (BLE) advertisements, and manages power-saving "Deep Sleep" cycles.
*   **Choice Rationale:** The ESP32 is selected for its **Dual-Core** architecture (Core 0 handles the radio, Core 1 handles the MKT math) and its integrated **Capacitive Touch** pins, which allow for a waterproof enclosure.

## 2. Power & Energy Subsystem (The "Uninterruptible" Loop)
This subsystem ensures the device survives "Dumsor" and long outreach trips.

| Component | Purpose | Rationale |
| :--- | :--- | :--- |
| **18650 Li-ion (2000mAh)** | Primary Energy Storage | High energy density and superior performance in the cold temperatures ($2^\circ C$ to $8^\circ C$) of a fridge compared to Li-Po batteries. |
| **TP4056 Module** | Battery Charging | Provides constant-current/constant-voltage (CC/CV) charging and over-discharge protection. Industry standard for 1S (Single Cell) safety. |
| **5V Mini Solar Panel** | Energy Harvesting | Provides "Trickle Charging" during motorbike or foot-based vaccine outreach trips. |
| **1N5822 Schottky Diode**| Reverse Flow Protection | Prevents the battery from draining back through the solar panel at night. Chosen for its **ultra-low voltage drop (0.3V)**, ensuring maximum solar efficiency. |
| **Dual INA219 Modules** | Power Auditing | **INA219 #1 (Address 0x40):** Measures Solar Input. **INA219 #2 (Address 0x41):** Measures System Drain. This allows the app to calculate net charging rates. |

## 3. Sensing & Precision Logging
Accuracy is mandatory for medical-grade vaccine safety.

| Component | Purpose | Rationale |
| :--- | :--- | :--- |
| **DS18B20 (Probe)** | Temperature Sensing | Digital "One-Wire" protocol prevents signal degradation over long wires. Accuracy of $\pm 0.5^\circ C$ meets WHO standards. |
| **4.7k $\Omega$ Resistor** | Pull-up for DS18B20 | Required to stabilize the One-Wire data line for error-free readings. |
| **MC-38 Reed Switch** | Door/Lid Detection | A magnetic switch that logs every time the fridge is opened. Essential for correlating heat spikes with human behavior. |
| **DS3231 RTC Module** | Real-Time Clock | The ESP32 internal clock resets on power loss. The DS3231 has a battery backup, ensuring every temperature reading is timestamped for MKT calculations. |
| **Micro SD Module** | Offline Data Vault | Stores years of temperature logs in `.CSV` format. This is the "Source of Truth" for medical audits when there is no internet. |

## 4. Human-Machine Interface (HMI)
Designed for non-tech-savvy nurses in high-pressure environments.

*   **1.3" I2C OLED Display:** High-contrast dashboard. **Rationale:** Visible in bright sunlight; uses I2C to share the same pins as the INA219s and RTC, saving GPIO pins.
*   **Capacitive Touch (Copper Foil):** No-hole buttons. **Rationale:** Zero mechanical wear and allows the 3D-printed case to be completely sealed/waterproof.
*   **5V Passive Buzzer:** Local Audible Alarm. **Rationale:** Provides an immediate "Beep" alert if the temperature exceeds $8^\circ C$, even if the nurse isn't looking at the phone.

---

## 5. Wiring Architecture (Bus Mapping)

### **I2C Bus (Pins 21 SDA / 22 SCL)**
All digital components share these two wires to simplify the circuit:
1.  **OLED Display** (Address 0x3C)
2.  **DS3231 RTC** (Address 0x68)
3.  **INA219 Solar** (Address 0x40)
4.  **INA219 Battery** (Address 0x41) — *Note: Requires soldering A0 jumper on the back.*

### **SPI Bus (Pins 18, 19, 23, 5)**
Dedicated to high-speed data transfer:
1.  **Micro SD Module**

### **Direct GPIOs**
1.  **DS18B20:** Pin 4 (One-Wire)
2.  **Reed Switch:** Pin 15 (Input Pullup)
3.  **Buzzer:** Pin 13 (PWM Output)
4.  **Touch Pad:** Pin 27 (Touch T7)
5.  **TP4056 CHRG Pin:** Pin 35 (Input - Detects if charging is active)

---

## 6. Environmental Protection Spec
*   **Silica Gel Packet:** Placed inside the case to absorb moisture and prevent internal condensation when moved between a $40^\circ C$ motorbike and a $4^\circ C$ fridge.
*   **Conformal Coating (Nail Polish):** Applied to the ESP32 and INA219 PCBs to prevent short circuits from high humidity.
*   **PG7 Glands:** Used at the exit points of the DS18B20 and Reed Switch wires to maintain the "Waterproof" rating.

---

## 7. The Logic Workflow (The "ColdGuard" Loop)
1.  **Wake:** Triggered by Timer (every 10m) or Touch (Nurse interaction).
2.  **Sample:** Read DS18B20, DS3231 Time, and Battery Voltage from INA219.
3.  **Math:** Add current temp to the MKT running exponential sum.
4.  **Log:** Append `Timestamp, Temp, MKT, Battery, DoorStatus` to `LOGS.CSV` on SD.
5.  **Alert:** If Temp $> 8^\circ C$ for $> 30$ mins, activate Buzzer.
6.  **Broadcast:** Advertise data via BLE for 2 minutes for the Expo App.
7.  **Sleep:** Enter Deep Sleep (mA current drops to near zero).
