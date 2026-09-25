"""Terminal diagnostics: python -m ct6339.scan [--probe]"""

import json
import sys

from . import probe


def main(argv=None):
    argv = argv or sys.argv[1:]
    do_probe = "--probe" in argv
    only = None
    for arg in argv:
        if arg.startswith("--only="):
            only = arg.split("=", 1)[1].upper()

    scan = {}
    scan["devices"], scan["device_error"] = probe.list_pnp_devices()
    scan["new_devices"] = []
    scan["serial"], scan["serial_error"] = probe.list_serial_ports()
    scan["hid"], scan["hid_error"] = probe.list_hid_devices()
    scan["usb"], scan["usb_error"] = probe.usb_descriptors()
    scan["serial_probes"] = []
    scan["hid_probes"] = []

    print("-- USB/HID device nodes --")
    for d in scan["devices"]:
        print("  %-4s %-45s %s:%s %s" % (d["bus"], d["name"][:45], d["vid"] or "----",
                                         d["pid"] or "----", d["com"]))
    if scan["device_error"]:
        print("  error: %s" % scan["device_error"])

    print("-- serial ports --")
    for p in scan["serial"]:
        print("  %s  %s" % (p["port"], p["desc"]))
    if scan["serial_error"]:
        print("  %s" % scan["serial_error"])

    print("-- HID --")
    for h in scan["hid"]:
        print("  %s:%s  %s" % (h["vid"], h["pid"], h["product"] or h["path"][:50]))
    if scan["hid_error"]:
        print("  %s" % scan["hid_error"])

    if do_probe:
        print("-- probing --")
        for p in scan["serial"]:
            scan["serial_probes"].append(probe.probe_serial(p["port"], on_log=lambda m: print("  " + m)))
        targets = [h for h in scan["hid"] if only in ("%s:%s" % (h["vid"], h["pid"]),)] if only else []
        if only and not targets:
            print("  no HID device matches %s" % only)
        if not only and scan["hid"]:
            print("  skipping %d HID devices (they are your own keyboard/mouse/etc)." % len(scan["hid"]))
            print("  to probe one: --only=VID:PID")
        for h in targets:
            scan["hid_probes"].append(probe.probe_hid(h["path"], on_log=lambda m: print("  " + m)))

    print("-- verdict --")
    print(probe.summarize(scan))

    if "--json" in argv:
        with open("ct6339_usb_report.json", "w", encoding="utf-8") as fh:
            json.dump(scan, fh, indent=2)
        print("wrote ct6339_usb_report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
