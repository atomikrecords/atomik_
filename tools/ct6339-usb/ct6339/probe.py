"""Read-only USB/HID/serial discovery and probing for a connected drone.

Nothing here writes firmware, changes device configuration, or issues
SET_FEATURE / SET_REPORT calls. Serial probing sends short, inert
attention strings only; HID probing reads input and feature reports.
"""

import json
import re
import subprocess
import time

VIDPID = re.compile(r"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})")
COMNAME = re.compile(r"\((COM\d+)\)")

# Short, inert strings used to see whether anything answers on a serial link.
SERIAL_PROBES = [
    b"\r\n",
    b"AT\r\n",
    b"?\r\n",
    b"version\r\n",
    b"\xaa\x55",
]
BAUDS = [115200, 57600, 38400, 19200, 9600, 250000]


def _powershell(script):
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)
    if out.returncode != 0:
        return None, (out.stderr or "").strip()
    text = (out.stdout or "").strip()
    if not text:
        return [], None
    try:
        data = json.loads(text)
    except ValueError as exc:
        return None, str(exc)
    return data if isinstance(data, list) else [data], None


def list_pnp_devices():
    """Every USB/HID PnP node Windows currently knows about."""
    script = (
        "Get-CimInstance Win32_PnPEntity | "
        "Where-Object { $_.PNPDeviceID -like 'USB\\*' -or $_.PNPDeviceID -like 'HID\\*' } | "
        "Select-Object Name,PNPDeviceID,Status,Service,Manufacturer,ClassGuid | "
        "ConvertTo-Json -Depth 3 -Compress"
    )
    rows, err = _powershell(script)
    if rows is None:
        return [], err
    devices = []
    for row in rows:
        did = row.get("PNPDeviceID") or ""
        m = VIDPID.search(did)
        com = COMNAME.search(row.get("Name") or "")
        devices.append({
            "name": row.get("Name") or "(unnamed)",
            "id": did,
            "bus": did.split("\\", 1)[0].upper(),
            "vid": m.group(1).upper() if m else "",
            "pid": m.group(2).upper() if m else "",
            "status": row.get("Status") or "",
            "service": row.get("Service") or "",
            "vendor": row.get("Manufacturer") or "",
            "com": com.group(1) if com else "",
        })
    devices.sort(key=lambda d: (d["bus"], d["name"].lower()))
    return devices, None


def diff_devices(before, after):
    """Devices present in `after` but not `before` — i.e. what plugging in added."""
    seen = {d["id"] for d in before}
    return [d for d in after if d["id"] not in seen]


def list_serial_ports():
    try:
        from serial.tools import list_ports
    except ImportError as exc:
        return [], "pyserial missing: %s" % exc
    ports = []
    for p in list_ports.comports():
        ports.append({
            "port": p.device,
            "desc": p.description or "",
            "hwid": p.hwid or "",
            "vid": "%04X" % p.vid if p.vid else "",
            "pid": "%04X" % p.pid if p.pid else "",
            "serial": p.serial_number or "",
        })
    return ports, None


def probe_serial(port, bauds=None, listen=0.8, on_log=None):
    """Listen, then send inert probes, at each baud rate. Reports raw replies."""
    try:
        import serial
    except ImportError as exc:
        return {"port": port, "error": "pyserial missing: %s" % exc, "hits": []}

    log = on_log or (lambda _m: None)
    result = {"port": port, "error": None, "hits": []}
    for baud in bauds or BAUDS:
        try:
            sp = serial.Serial(port, baud, timeout=0.3, write_timeout=1.0)
        except Exception as exc:  # port busy, no driver, access denied
            result["error"] = str(exc)
            log("%s @ %d: cannot open (%s)" % (port, baud, exc))
            break
        try:
            sp.dtr = True
            sp.rts = True
            time.sleep(0.15)
            sp.reset_input_buffer()

            passive = _read_for(sp, listen)
            if passive:
                result["hits"].append({"baud": baud, "probe": "(passive)", "reply": passive.hex()})
                log("%s @ %d: unsolicited %s" % (port, baud, passive.hex()))

            for probe in SERIAL_PROBES:
                sp.reset_input_buffer()
                sp.write(probe)
                sp.flush()
                reply = _read_for(sp, 0.4)
                if reply:
                    result["hits"].append({"baud": baud, "probe": probe.hex(), "reply": reply.hex()})
                    log("%s @ %d: %s -> %s" % (port, baud, probe.hex(), reply.hex()))
        except Exception as exc:
            log("%s @ %d: %s" % (port, baud, exc))
        finally:
            sp.close()
    return result


def _read_for(sp, seconds):
    end = time.time() + seconds
    buf = bytearray()
    while time.time() < end:
        chunk = sp.read(256)
        if chunk:
            buf += chunk
        if len(buf) > 4096:
            break
    return bytes(buf)


def list_hid_devices():
    try:
        import hid
    except ImportError as exc:
        return [], "hidapi missing: %s" % exc
    devices = []
    try:
        for d in hid.enumerate():
            devices.append({
                "vid": "%04X" % d["vendor_id"],
                "pid": "%04X" % d["product_id"],
                "path": d["path"].decode(errors="replace") if isinstance(d["path"], bytes) else str(d["path"]),
                "product": d.get("product_string") or "",
                "vendor": d.get("manufacturer_string") or "",
                "usage_page": d.get("usage_page", 0),
                "usage": d.get("usage", 0),
                "iface": d.get("interface_number", -1),
            })
    except Exception as exc:
        return [], str(exc)
    return devices, None


def probe_hid(path, listen=1.5, on_log=None):
    """Read input reports, then try GET_FEATURE for a few report ids. Read-only."""
    try:
        import hid
    except ImportError as exc:
        return {"path": path, "error": "hidapi missing: %s" % exc, "inputs": [], "features": []}

    log = on_log or (lambda _m: None)
    result = {"path": path, "error": None, "inputs": [], "features": []}
    dev = hid.device()
    try:
        dev.open_path(path.encode() if isinstance(path, str) else path)
    except Exception as exc:
        result["error"] = str(exc)
        log("HID open failed: %s" % exc)
        return result
    try:
        dev.set_nonblocking(True)
        end = time.time() + listen
        while time.time() < end:
            try:
                data = dev.read(64)
            except (OSError, ValueError) as exc:
                result["error"] = str(exc)
                log("HID read error: %s" % exc)
                break
            if data:
                frame = bytes(data).hex()
                if frame not in result["inputs"]:
                    result["inputs"].append(frame)
                    log("HID in: %s" % frame)
            else:
                time.sleep(0.02)
        for rid in range(0, 6):
            try:
                feat = dev.get_feature_report(rid, 64)
            except Exception:
                continue
            if feat:
                result["features"].append({"id": rid, "data": bytes(feat).hex()})
                log("HID feature %d: %s" % (rid, bytes(feat).hex()))
    finally:
        dev.close()
    return result


def usb_descriptors():
    """libusb view: interface classes tell us if anything beyond charging exists."""
    try:
        import usb.core
        import usb.util
    except ImportError as exc:
        return [], "pyusb missing: %s" % exc
    out = []
    try:
        devs = list(usb.core.find(find_all=True))
    except Exception as exc:
        return [], str(exc)
    for d in devs:
        entry = {"vid": "%04X" % d.idVendor, "pid": "%04X" % d.idProduct, "interfaces": []}
        try:
            for cfg in d:
                for itf in cfg:
                    entry["interfaces"].append({
                        "num": itf.bInterfaceNumber,
                        "class": itf.bInterfaceClass,
                        "subclass": itf.bInterfaceSubClass,
                        "protocol": itf.bInterfaceProtocol,
                        "endpoints": [
                            {"addr": "0x%02X" % e.bEndpointAddress, "type": e.bmAttributes & 0x3}
                            for e in itf
                        ],
                    })
        except Exception as exc:
            entry["error"] = str(exc)
        out.append(entry)
    return out, None


CLASS_NAMES = {
    0x01: "audio", 0x02: "CDC control", 0x03: "HID", 0x06: "still image",
    0x07: "printer", 0x08: "mass storage", 0x0A: "CDC data", 0x0B: "smart card",
    0x0E: "video", 0xE0: "wireless", 0xFF: "vendor-specific",
}


def failed_nodes(devices):
    """Nodes Windows could not enumerate — descriptor request failed, driver error."""
    out = []
    for d in devices:
        bad_name = "unknown usb device" in d["name"].lower()
        bad_status = d["status"] not in ("OK", "")
        if bad_name or bad_status:
            out.append(d)
    return out


def summarize(scan):
    """Plain verdict about what the PC can actually talk to."""
    lines = []
    new = scan.get("new_devices") or []
    serial_ports = scan.get("serial") or []
    hid_devs = scan.get("hid") or []
    responsive = [h for h in scan.get("serial_probes", []) if h.get("hits")]
    hid_alive = [h for h in scan.get("hid_probes", []) if h.get("inputs") or h.get("features")]

    errors = [scan.get(k) for k in ("device_error", "serial_error", "hid_error") if scan.get(k)]
    if not new and not serial_ports and not hid_devs:
        if errors:
            lines.append("Detection incomplete: %s" % "; ".join(errors))
            lines.append("Fix the above before trusting this result.")
        else:
            lines.append("No USB data device enumerated. Cable/port is charge-only, or D+/D- are not wired.")
    else:
        if new:
            lines.append("%d device node(s) appeared on plug-in." % len(new))
        if serial_ports:
            lines.append("Serial (COM) interface: %s" % ", ".join(p["port"] for p in serial_ports))
        if hid_devs:
            lines.append("HID interface: %d endpoint(s) visible." % len(hid_devs))
    if responsive:
        lines.append("ANSWERS on serial: %s" % ", ".join(sorted({r["port"] for r in responsive})))
    elif serial_ports:
        lines.append("Serial port exists but nothing answered any probe.")
    if hid_alive:
        lines.append("HID reports readable: %d device(s)." % len(hid_alive))
    elif hid_devs:
        lines.append("HID present but returned no data.")

    bad = failed_nodes(scan.get("devices", []))
    if bad:
        lines.append("")
        lines.append("Failed to enumerate (%d):" % len(bad))
        for d in bad:
            lines.append("  %s [%s] %s" % (d["name"], d["status"] or "?", d["id"]))
        lines.append("A descriptor request failure means the device never completed the USB")
        lines.append("handshake: no interfaces, no endpoints, nothing to talk to. Usually a")
        lines.append("power-only port with floating data lines, or a bad cable.")

    lines.append("")
    lines.append("Control panel is unlocked only when a channel actually answers.")
    return "\n".join(lines)


def link_is_usable(scan):
    if any(h.get("hits") for h in scan.get("serial_probes", [])):
        return True
    return any(h.get("inputs") or h.get("features") for h in scan.get("hid_probes", []))
