"""Frame building and output for the control panel.

The CT-6339 protocol is not published, so nothing here is a known-good
command set. Frames are built from a template the user picks, and are
only transmitted after output is explicitly enabled on a channel that
answered during diagnostics.
"""

import threading
import time

# Templates are generic layouts seen in cheap FC/toy-drone serial links.
# Each returns bytes for (arm, [m1..m4] as 0..100).
TEMPLATES = {}


def template(name):
    def wrap(fn):
        TEMPLATES[name] = fn
        return fn
    return wrap


@template("A: AA 55 | arm | m1..m4 | xor")
def _tpl_a(arm, motors):
    body = bytes([1 if arm else 0] + [int(round(m * 255 / 100)) for m in motors])
    chk = 0
    for b in body:
        chk ^= b
    return b"\xaa\x55" + body + bytes([chk])


@template("B: $M< | arm | m1..m4 | sum")
def _tpl_b(arm, motors):
    body = bytes([1 if arm else 0] + [int(round(m * 255 / 100)) for m in motors])
    return b"$M<" + bytes([len(body)]) + body + bytes([sum(body) & 0xFF])


@template("C: text 'T a m1 m2 m3 m4'")
def _tpl_c(arm, motors):
    return ("T %d %d %d %d %d\r\n" % (1 if arm else 0, *[int(m) for m in motors])).encode()


@template("D: HID report 0 | arm | m1..m4")
def _tpl_d(arm, motors):
    return bytes([0x00, 1 if arm else 0] + [int(round(m * 255 / 100)) for m in motors])


def build(template_name, arm, motors):
    return TEMPLATES[template_name](arm, motors)


class Transmitter:
    """Repeats the current frame at a fixed rate on the selected channel."""

    RATE_HZ = 20

    def __init__(self, on_log):
        self.on_log = on_log
        self._lock = threading.Lock()
        self._thread = None
        self._stop = threading.Event()
        self._frame = b""
        self._channel = None  # ("serial", port, baud) or ("hid", path)
        self._handle = None

    @property
    def running(self):
        return self._thread is not None and self._thread.is_alive()

    def start(self, channel):
        self.stop()
        self._channel = channel
        self._open()
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1.0)
        self._thread = None
        self._close()

    def set_frame(self, frame):
        with self._lock:
            self._frame = frame

    def _open(self):
        kind = self._channel[0]
        if kind == "serial":
            import serial
            _, port, baud = self._channel
            self._handle = serial.Serial(port, baud, timeout=0.2, write_timeout=0.5)
            self.on_log("Output open: %s @ %d" % (port, baud))
        else:
            import hid
            path = self._channel[1]
            self._handle = hid.device()
            self._handle.open_path(path.encode() if isinstance(path, str) else path)
            self.on_log("Output open: HID %s" % path)

    def _close(self):
        if self._handle is not None:
            try:
                self._handle.close()
            except Exception:
                pass
            self._handle = None

    def _loop(self):
        period = 1.0 / self.RATE_HZ
        while not self._stop.is_set():
            with self._lock:
                frame = self._frame
            if frame and self._handle is not None:
                try:
                    if self._channel[0] == "serial":
                        self._handle.write(frame)
                    else:
                        self._handle.write(frame)
                except Exception as exc:
                    self.on_log("TX error: %s" % exc)
                    break
            time.sleep(period)
