# CT-6339 USB Tool

Read-only USB diagnostics for the drone, plus a control panel that stays locked
until something actually answers. Nothing flashes or reconfigures the drone.

## Run (Windows)

Double-click `run.bat` (needs Python 3.9+ from python.org, "Add to PATH" checked).
It installs `pyserial`, `hidapi`, `pyusb` and opens the app.

## Order of use

1. **Detect** — with the drone *unplugged*, click **Baseline**. Plug the drone in,
   wait 5 s, click **Scan**. New device nodes are highlighted green.
   If nothing new appears: the port/cable is charge-only (D+/D- not wired).
2. **Probe** — pick a channel and click **Probe**.
   - Serial: listens, then sends `\r\n`, `AT`, `?`, `version`, `AA 55` at
     115200/57600/38400/19200/9600/250000. Any reply is logged as hex.
   - HID: reads input reports for 1.5 s, then GET_FEATURE for report ids 0-5.
     No SET_REPORT, no writes.
   - USB descriptors are read via libusb when a WinUSB-class driver is bound.
3. **Control** — unlocked only if step 2 got a reply. Pick channel, frame
   template, ARM, move sliders. Frames are shown as hex first; nothing is sent
   until **Enable output** is ticked. Sent at 20 Hz. **STOP ALL** zeroes and disarms.

**Save report** writes everything found to JSON.

## Honest limits

- The CT-6339 protocol is not public. The four frame templates are generic
  layouts, not known-good commands — if the drone answers, the probe log is
  what tells you the real format.
- Most cheap drones wire USB for 5 V charging only. In that case step 1 shows
  nothing and steps 2-3 have nothing to talk to. That is a valid result.
- Remove propellers before enabling output.

## Files

- `ct6339/probe.py` — enumeration (PowerShell/PnP), serial/HID/libusb probing, verdict
- `ct6339/control.py` — frame templates and the 20 Hz transmitter
- `ct6339/app.py` — Tkinter UI
