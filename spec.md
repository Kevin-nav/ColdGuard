# Mobile App Specification: ColdGuard App

**Version:** 1.0  
**Framework:** Expo (React Native)  
**Backend:** Convex  
**Authentication:** Firebase Auth  

---

## 1. Primary Objectives
1.  **Bridging the Field Gap:** Allow nurses to download critical vaccine safety data (MKT) from the ColdGuard device without an internet connection.
2.  **Institutional Oversight:** Automatically sync collected data to the cloud once the phone reaches a 3G/4G or WiFi zone.
3.  **Real-Time Alerts:** Provide high-contrast, immediate visual alerts if a monitored fridge/carrier is out of safe range.

---

## 2. Technical Stack
*   **Frontend:** Expo SDK (Managed Workflow with Config Plugins for Bluetooth).
*   **State Management:** TanStack Query (for Convex data) and `Zustand` or `Redux` for local offline state.
*   **Local Storage:** `expo-sqlite` or `react-native-mmkv` (to store device logs before cloud upload).
*   **Communication:** 
    *   `react-native-ble-plx` for discovery and small data packets.
    *   `expo-network` / `expo-dev-client` for automated WiFi AP connection logic.
*   **Visualizations:** `react-native-wagmi-charts` or `victory-native` for temperature graphs.

---

## 3. Core Feature Modules

### A. Authentication & Onboarding (Firebase)
*   **Social/Email Login:** Google Sign-in and Email/Password.
*   **Institutional Linking:** Upon first login, users must scan an "Institution QR Code" to link their app to a specific Clinic (e.g., Korle-Bu Hospital).
*   **Clinic Secret:** The app downloads a "Handshake Token" unique to that clinic, stored in `expo-secure-store`.

### B. Device Discovery Dashboard (BLE)
*   **Background Scanning:** The app scans for BLE advertisements with the ColdGuard Service UUID.
*   **Device Cards:** Displays all nearby ColdGuard units with:
    *   Current Temp (Real-time via BLE Notify).
    *   MKT Status (Safe/Warning).
    *   Battery Level.
    *   Door Status (Open/Closed).

### C. The "Sync Engine" (The Core Logic)
This module handles the data transfer from the ESP32 SD Card to the Cloud.
1.  **Handshake:** App connects to ESP32 $\rightarrow$ App sends "Clinic Secret."
2.  **Differential Sync:** App asks ESP32: *"Give me logs starting from Line [X]."*
3.  **Handover:** For large logs (>100 lines), the app programmatically switches the phone's WiFi to the ESP32’s Access Point (e.g., SSID: "ColdGuard_01").
4.  **Local Storage:** CSV data is saved into a local SQLite database on the phone.
5.  **Cloud Push:** A background task monitors connectivity. When internet is detected, the App pushes the SQLite logs to **Convex**.

### D. Session & Inventory Management
*   **Session Start:** Nurse selects vaccine types (e.g., "BCG", "OPV") and quantity before starting an outreach trip.
*   **Audit Trail:** Every data point is tagged with the User ID (Firebase) and Device ID (ESP32 MAC).

---

## 4. UI/UX Requirements
*   **High Contrast:** UI must be readable in bright Ghanaian sunlight (High-contrast mode).
*   **Status Indicators:**
    *   **Green:** All safe ($2^\circ C$ to $8^\circ C$ and MKT within limits).
    *   **Amber:** Door open or temperature "excursion" (heat spike) in progress.
    *   **Red:** MKT limit exceeded. Vaccines potentially compromised.
*   **Troubleshooting Guide:** A built-in "Help" section with pictures showing how to reset the ESP32 or check the Reed Switch.

---

## 5. Convex Database Schema (Simplified)

```typescript
// Proposed Convex Schema
{
  institutions: { name: string, secretKey: string },
  users: { clerkId: string, institutionId: id, name: string },
  devices: { macAddress: string, institutionId: id, nickname: string },
  readings: { 
    deviceId: id, 
    temp: number, 
    mkt: number, 
    doorOpen: boolean, 
    timestamp: number,
    sessionId: id 
  },
  sessions: { 
    institutionId: id, 
    userId: id, 
    vaccineType: string, 
    startTime: number 
  }
}
```

---

## 6. Offline Math (MKT Calculation)
The app must be able to verify MKT calculations locally using the logs downloaded from the device.
$$ T_K = \frac{\Delta H / R}{-\ln \left( \frac{\sum e^{-\Delta H / RT_n}}{n} \right)} $$
*   **Activation Energy (\(\Delta H\)):** Default to $83.144 \text{ kJ/mol}$.
*   **Gas Constant (\(R\)):** $0.0083144 \text{ kJ/mol}\cdot K$.

---

## 7. Success Criteria for Developers
1.  **Successful BLE Discovery:** App identifies a ColdGuard device within 3 seconds of scanning.
2.  **No-Touch Sync:** Data transfers from the device to the phone's local storage without the user manually entering WiFi settings.
3.  **Data Persistence:** A nurse can "sync" three different fridges while offline, and all data successfully reaches Convex later that evening when internet is restored.
