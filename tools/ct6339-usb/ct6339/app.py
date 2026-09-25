"""CT-6339 USB tool: detect first, probe second, control only if a link answers."""

import json
import os
import queue
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from . import control, probe

PAD = {"padx": 8, "pady": 6}


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("CT-6339 USB Tool")
        self.geometry("900x620")

        self.baseline = []
        self.scan = {}
        self.events = queue.Queue()
        self.tx = control.Transmitter(self.log)

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True)
        self.tab_detect = ttk.Frame(nb)
        self.tab_probe = ttk.Frame(nb)
        self.tab_control = ttk.Frame(nb)
        nb.add(self.tab_detect, text="1. Detect")
        nb.add(self.tab_probe, text="2. Probe")
        nb.add(self.tab_control, text="3. Control")

        self._build_detect()
        self._build_probe()
        self._build_control()

        self.status = tk.StringVar(value="Ready")
        ttk.Label(self, textvariable=self.status, relief="sunken", anchor="w").pack(fill="x")

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(100, self._drain)

    # ---------- tab 1 ----------
    def _build_detect(self):
        bar = ttk.Frame(self.tab_detect)
        bar.pack(fill="x", **PAD)
        ttk.Button(bar, text="Baseline (drone unplugged)", command=self.do_baseline).pack(side="left", padx=4)
        ttk.Button(bar, text="Scan (drone plugged in)", command=self.do_scan).pack(side="left", padx=4)
        ttk.Button(bar, text="Save report", command=self.save_report).pack(side="left", padx=4)

        self.verdict = tk.Text(self.tab_detect, height=6, wrap="word")
        self.verdict.pack(fill="x", **PAD)

        cols = ("bus", "name", "vid", "pid", "com", "status")
        self.tree = ttk.Treeview(self.tab_detect, columns=cols, show="headings")
        for c, w in zip(cols, (60, 380, 60, 60, 70, 90)):
            self.tree.heading(c, text=c.upper())
            self.tree.column(c, width=w, anchor="w")
        self.tree.pack(fill="both", expand=True, **PAD)

    def do_baseline(self):
        def work():
            devs, err = probe.list_pnp_devices()
            self.events.put(("baseline", (devs, err)))
        self._run(work, "Reading baseline...")

    def do_scan(self):
        def work():
            scan = {}
            devs, err = probe.list_pnp_devices()
            scan["devices"] = devs
            scan["device_error"] = err
            scan["new_devices"] = probe.diff_devices(self.baseline, devs) if self.baseline else []
            scan["serial"], scan["serial_error"] = probe.list_serial_ports()
            scan["hid"], scan["hid_error"] = probe.list_hid_devices()
            scan["usb"], scan["usb_error"] = probe.usb_descriptors()
            scan["serial_probes"] = []
            scan["hid_probes"] = []
            self.events.put(("scan", scan))
        self._run(work, "Scanning...")

    def _show_scan(self, scan):
        self.scan = scan
        self.tree.delete(*self.tree.get_children())
        new_ids = {d["id"] for d in scan.get("new_devices", [])}
        for d in scan.get("devices", []):
            tag = "new" if d["id"] in new_ids else ""
            self.tree.insert("", "end", tags=(tag,), values=(
                d["bus"], d["name"], d["vid"], d["pid"], d["com"], d["status"]))
        self.tree.tag_configure("new", background="#d8f5d8")
        self.verdict.delete("1.0", "end")
        self.verdict.insert("1.0", probe.summarize(scan))
        self._fill_channels()
        self._refresh_lock()

    # ---------- tab 2 ----------
    def _build_probe(self):
        bar = ttk.Frame(self.tab_probe)
        bar.pack(fill="x", **PAD)
        ttk.Label(bar, text="Channel").pack(side="left")
        self.probe_channel = ttk.Combobox(bar, width=60, state="readonly")
        self.probe_channel.pack(side="left", padx=6)
        ttk.Button(bar, text="Probe", command=self.do_probe).pack(side="left", padx=4)
        ttk.Button(bar, text="Clear log", command=lambda: self.logbox.delete("1.0", "end")).pack(side="left")

        self.logbox = tk.Text(self.tab_probe, wrap="none")
        self.logbox.pack(fill="both", expand=True, **PAD)

    def _fill_channels(self):
        self.channels = []
        for p in self.scan.get("serial", []):
            self.channels.append(("serial", p["port"], "COM %s  %s" % (p["port"], p["desc"])))
        for h in self.scan.get("hid", []):
            label = "HID %s:%s  %s" % (h["vid"], h["pid"], h["product"] or h["path"][:40])
            self.channels.append(("hid", h["path"], label))
        labels = [c[2] for c in self.channels]
        self.probe_channel["values"] = labels
        self.control_channel["values"] = labels
        if labels:
            self.probe_channel.current(0)
            self.control_channel.current(0)

    def do_probe(self):
        idx = self.probe_channel.current()
        if idx < 0:
            messagebox.showinfo("CT-6339", "Scan first.")
            return
        kind, target, _ = self.channels[idx]

        def work():
            if kind == "serial":
                res = probe.probe_serial(target, on_log=self.log)
                self.events.put(("serial_probe", res))
            else:
                res = probe.probe_hid(target, on_log=self.log)
                self.events.put(("hid_probe", res))
        self._run(work, "Probing %s..." % target)

    # ---------- tab 3 ----------
    def _build_control(self):
        self.lock_msg = tk.StringVar(value="Locked — no channel has answered yet.")
        self.lock_label = ttk.Label(self.tab_control, textvariable=self.lock_msg, foreground="#a00")
        self.lock_label.pack(anchor="w", **PAD)

        top = ttk.Frame(self.tab_control)
        top.pack(fill="x", **PAD)
        ttk.Label(top, text="Channel").grid(row=0, column=0, sticky="w")
        self.control_channel = ttk.Combobox(top, width=50, state="readonly")
        self.control_channel.grid(row=0, column=1, sticky="w", padx=6)
        ttk.Label(top, text="Baud").grid(row=0, column=2, sticky="w")
        self.baud = ttk.Combobox(top, width=10, state="readonly",
                                 values=[str(b) for b in probe.BAUDS])
        self.baud.current(0)
        self.baud.grid(row=0, column=3, padx=6)
        ttk.Label(top, text="Frame").grid(row=1, column=0, sticky="w")
        self.template = ttk.Combobox(top, width=50, state="readonly",
                                     values=list(control.TEMPLATES))
        self.template.current(0)
        self.template.grid(row=1, column=1, sticky="w", padx=6, pady=4)
        self.template.bind("<<ComboboxSelected>>", lambda _e: self._update_frame())

        self.output_on = tk.BooleanVar(value=False)
        self.output_box = ttk.Checkbutton(top, text="Enable output", variable=self.output_on,
                                          command=self._toggle_output)
        self.output_box.grid(row=1, column=2, columnspan=2, sticky="w")

        arm = ttk.Frame(self.tab_control)
        arm.pack(fill="x", **PAD)
        self.armed = tk.BooleanVar(value=False)
        self.arm_btn = ttk.Button(arm, text="ARM", command=self._toggle_arm, width=14)
        self.arm_btn.pack(side="left")
        ttk.Button(arm, text="STOP ALL", command=self._stop_all, width=14).pack(side="left", padx=8)
        self.arm_state = ttk.Label(arm, text="DISARMED")
        self.arm_state.pack(side="left", padx=8)

        sliders = ttk.Frame(self.tab_control)
        sliders.pack(fill="x", **PAD)
        self.motor_vars = []
        for i in range(4):
            ttk.Label(sliders, text="M%d" % (i + 1)).grid(row=i, column=0, sticky="w")
            var = tk.DoubleVar(value=0.0)
            scale = ttk.Scale(sliders, from_=0, to=100, variable=var, length=560,
                              command=lambda _v: self._update_frame())
            scale.grid(row=i, column=1, padx=8, pady=3)
            lbl = ttk.Label(sliders, text="0%", width=5)
            lbl.grid(row=i, column=2, sticky="w")
            self.motor_vars.append((var, scale, lbl))

        self.frame_preview = tk.Text(self.tab_control, height=3, wrap="word")
        self.frame_preview.pack(fill="x", **PAD)
        self._refresh_lock()

    def _refresh_lock(self):
        usable = probe.link_is_usable(self.scan) if self.scan else False
        for _var, scale, _lbl in self.motor_vars:
            scale.state(["!disabled"] if usable else ["disabled"])
        self.arm_btn.state(["!disabled"] if usable else ["disabled"])
        self.output_box.state(["!disabled"] if usable else ["disabled"])
        self.lock_msg.set("Unlocked — a channel answered during probing."
                          if usable else "Locked — no channel has answered yet.")
        self.lock_label.configure(foreground="#070" if usable else "#a00")
        self._update_frame()

    def _toggle_arm(self):
        if self.armed.get():
            self._stop_all()
            return
        self.armed.set(True)
        self.arm_state.configure(text="ARMED")
        self.arm_btn.configure(text="DISARM")
        self._update_frame()

    def _stop_all(self):
        self.armed.set(False)
        for var, _scale, lbl in self.motor_vars:
            var.set(0.0)
            lbl.configure(text="0%")
        self.arm_state.configure(text="DISARMED")
        self.arm_btn.configure(text="ARM")
        self._update_frame()

    def _current_frame(self):
        motors = [v.get() for v, _s, _l in self.motor_vars]
        return control.build(self.template.get(), self.armed.get(), motors)

    def _update_frame(self):
        for var, _scale, lbl in self.motor_vars:
            lbl.configure(text="%d%%" % int(round(var.get())))
        try:
            frame = self._current_frame()
        except Exception as exc:
            frame = b""
            self.log("frame error: %s" % exc)
        self.frame_preview.delete("1.0", "end")
        self.frame_preview.insert("1.0", frame.hex(" ") or "(none)")
        if self.tx.running:
            self.tx.set_frame(frame)

    def _toggle_output(self):
        if not self.output_on.get():
            self.tx.stop()
            self.log("Output stopped.")
            return
        idx = self.control_channel.current()
        if idx < 0:
            self.output_on.set(False)
            return
        kind, target, _ = self.channels[idx]
        channel = ("serial", target, int(self.baud.get())) if kind == "serial" else ("hid", target)
        try:
            self.tx.start(channel)
            self.tx.set_frame(self._current_frame())
        except Exception as exc:
            self.output_on.set(False)
            messagebox.showerror("CT-6339", str(exc))

    # ---------- plumbing ----------
    def _run(self, work, status):
        self.status.set(status)
        threading.Thread(target=work, daemon=True).start()

    def log(self, msg):
        self.events.put(("log", msg))

    def _drain(self):
        while True:
            try:
                kind, payload = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == "log":
                self.logbox.insert("end", payload + "\n")
                self.logbox.see("end")
            elif kind == "baseline":
                devs, err = payload
                self.baseline = devs
                self.status.set("Baseline: %d devices%s" % (len(devs), (" (%s)" % err) if err else ""))
            elif kind == "scan":
                self._show_scan(payload)
                self.status.set("Scan complete")
            elif kind == "serial_probe":
                self.scan.setdefault("serial_probes", []).append(payload)
                self.status.set("Serial probe done: %d hit(s)" % len(payload.get("hits", [])))
                self._refresh_lock()
            elif kind == "hid_probe":
                self.scan.setdefault("hid_probes", []).append(payload)
                n = len(payload.get("inputs", [])) + len(payload.get("features", []))
                self.status.set("HID probe done: %d report(s)" % n)
                self._refresh_lock()
        self.after(100, self._drain)

    def save_report(self):
        if not self.scan:
            messagebox.showinfo("CT-6339", "Scan first.")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".json", initialfile="ct6339_usb_report.json",
            initialdir=os.path.expanduser("~"))
        if not path:
            return
        data = dict(self.scan)
        data["verdict"] = probe.summarize(self.scan)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        self.status.set("Saved %s" % path)

    def _on_close(self):
        try:
            self.tx.stop()
        finally:
            self.destroy()


def main():
    App().mainloop()


if __name__ == "__main__":
    main()
