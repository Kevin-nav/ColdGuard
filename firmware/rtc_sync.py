import time

import serial

PORT = "COM6"
BAUD = 115200

with serial.Serial(PORT, BAUD, timeout=10) as ser:
    print("Waiting for ESP32 to be ready...")
    # Wait until ESP32 sends "READY"
    while True:
        line = ser.readline().decode(errors="ignore").strip()
        print(f"  ESP32: {line}")
        if line == "READY":
            break

    timestamp = int(time.time())
    ser.write(f"{timestamp}\n".encode())
    print(f"Sent timestamp: {timestamp}")

    response = ser.readline().decode(errors="ignore").strip()
    print(f"ESP32 says: {response}")
