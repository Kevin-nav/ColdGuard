#include <Wire.h>
#include <RTClib.h>

RTC_DS3231 rtc;

void setup() {
    Serial.begin(115200);
    Wire.begin();

    if (!rtc.begin()) {
        Serial.println("ERROR: RTC module not found! Check wiring (SDA=21, SCL=22).");
        while (true) delay(1000);
    }
    Serial.println("RTC module found.");

    // Always sync on every upload
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)) + TimeSpan(10));
    Serial.println("RTC synced.");

    DateTime now = rtc.now();
    Serial.printf(
        "Current RTC time: %04d-%02d-%02d %02d:%02d:%02d\n",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second()
    );
}



void loop() {
    // Optional: print time every second to verify
    DateTime now = rtc.now();
    Serial.printf(
        "%04d-%02d-%02d %02d:%02d:%02d\n",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second()
    );
    delay(1000);
}