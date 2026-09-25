"""Terminal diagnostics: python -m ct6339.scan [--probe] [--watch]"""

import json
import sys
import time

from . import probe


def watch():
    """Print USB/COM changes live. Plug the drone in and see what appears."""
    print("Watching. Plug/unplug the drone. Ctrl+C to stop.\n")
    prev_dev, _ = probe.list_pnp_devices()
    prev_com, _ = probe.list_serial_ports()
    prev = {d["id"]: d for d in prev_dev}
    prev_ports = {p["port"] for p in prev_com}
    print("baseline: %d device nodes, %d COM ports" % (len(prev), len(prev_ports)))
    ticks = 0
    try:
        while True:
            time.sleep(1.5)
            ticks += 1
            print("\r  watching... %ds  " % int(ticks * 1.5), end="", flush=True)
            devs, err = probe.list_pnp_devices()
            if err:
                continue
            now = {d["id"]: d for d in devs}
            for did in now.keys() - prev.keys():
                d = now[did]
                print("\r+ %-4s %-45s %s:%s %s [%s]" % (d["bus"], d["name"][:45],
                                                      d["vid"] or "----", d["pid"] or "----",
                                                      d["com"], d["status"]))
                print("    %s" % did)
            for did in prev.keys() - now.keys():
                print("\r- %s" % prev[did]["name"][:60])
            prev = now

            coms, _ = probe.list_serial_ports()
            ports = {p["port"] for p in coms}
            for port in ports - prev_ports:
                print("\r+ COM %s" % port)
            for port in prev_ports - ports:
                print("\r- COM %s" % port)
            prev_ports = ports
    except KeyboardInterrupt:
        print("\nstopped")


def main(argv=None):
    argv = argv or sys.argv[1:]
    if "--watch" in argv:
        watch()
        return 0

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
